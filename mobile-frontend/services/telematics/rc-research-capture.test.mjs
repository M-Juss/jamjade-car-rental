import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { CalibrationAccumulator, rotationAxes } from '../../lib/telematics/calibration.ts';

const protocol = { version: 1, recording_mode: 'manual', requested_interval_ms: 20,
  minimum_duration_ms: 1000, max_samples: 10000, max_samples_json_bytes: 4000000, consent_version: 1 };
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
function harness({ platform = 'android', granted = true } = {}) {
  let clock = 0, listener, appListener, removed = 0, nextTimer = 0;
  const timers = new Map();
  const exports = {};
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [Date.UTC(2026, 9, 18) + clock])); }
    static now() { return Date.UTC(2026, 9, 18) + clock; }
  }
  const source = readFileSync(new URL('./rc-research-capture.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Date: ClockDate, AbortController, Error, Promise, performance: { now: () => clock },
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, at: clock + delay }); return id; },
    setInterval(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, at: clock + delay, repeat: delay }); return id; },
    clearTimeout(id) { timers.delete(id); }, clearInterval(id) { timers.delete(id); },
    require(name) {
      if (name === 'expo-sensors') return { DeviceMotion: {
        isAvailableAsync: async () => true, getPermissionsAsync: async () => ({ granted }),
        requestPermissionsAsync: async () => ({ granted }), setUpdateInterval() {},
        addListener(callback) { listener = callback; return { remove() { removed++; listener = null; } }; },
      } };
      if (name === 'react-native') return { Platform: { OS: platform }, AppState: {
        currentState: 'active', addEventListener(_, callback) { appListener = callback; return { remove() { appListener = null; } }; },
      } };
      if (name.endsWith('/calibration')) return { CalibrationAccumulator, rotationAxes };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  function advance(time) {
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= time).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      const [id, timer] = due;
      clock = timer.at;
      if (timer.repeat) timer.at += timer.repeat; else timers.delete(id);
      timer.callback();
    }
    clock = time;
  }
  return { capture: exports.captureRcResearch, advance,
    emit(time, timestamp = 100 + time / 1000) {
      advance(time);
      listener?.({ acceleration: { x: 0.2, y: 0, z: 0, timestamp },
        accelerationIncludingGravity: { x: 0.2, y: -9.80665, z: 0, timestamp },
        rotationRate: { alpha: 1, beta: 2, gamma: 3, timestamp }, orientation: 0 });
    }, background() { appListener?.('background'); },
    get active() { return Boolean(listener); }, get timers() { return timers.size; }, get removed() { return removed; },
  };
}

test('unsupported runtimes cannot subscribe to research motion', async () => {
  for (const platform of ['ios', 'web']) {
    const h = harness({ platform });
    await assert.rejects(h.capture(protocol, new AbortController().signal, new AbortController().signal, () => {}), /Android/);
    assert.equal(h.active, false);
    assert.equal(h.timers, 0);
  }
});

for (const platform of ['android']) test(`${platform}: records beyond ten seconds until manual stop and releases resources`, async () => {
  const h = harness({ platform }), stop = new AbortController();
  let completed = false;
  const result = h.capture(protocol, new AbortController().signal, stop.signal, () => {}).then(value => { completed = true; return value; });
  await settle();
  for (let i = 1; i <= 2250; i++) h.emit(i * 20);
  await settle();
  assert.equal(completed, false); assert.equal(h.active, true);
  stop.abort();
  const recording = await result;
  assert.ok(recording.summary.duration_ms > 40000);
  assert.ok(recording.samples.length > 2000);
  assert.equal(recording.samples[0].rotation_x, 1);
  assert.equal(recording.samples[0].rotation_z, 3);
  assert.equal(recording.samples[0].elapsed_ms, 0);
  assert.equal(h.active, false); assert.equal(h.timers, 0); assert.equal(h.removed, 1);
});

test('an early manual stop rejects an incomplete recording', async () => {
  const h = harness(), stop = new AbortController();
  const result = h.capture(protocol, new AbortController().signal, stop.signal, () => {});
  const rejected = assert.rejects(result, /at least one second/);
  await settle(); h.emit(20); stop.abort(); await rejected;
  assert.equal(h.active, false); assert.equal(h.timers, 0);
});

for (const background of [false, true]) test(`interruption (${background ? 'background' : 'cancel'}) discards samples and cleans up`, async () => {
  const h = harness(), cancel = new AbortController();
  const result = h.capture(protocol, cancel.signal, new AbortController().signal, () => {});
  const rejected = assert.rejects(result, /Keep the app open/);
  await settle(); for (let i = 1; i <= 70; i++) h.emit(i * 20);
  if (background) h.background(); else cancel.abort();
  await rejected; assert.equal(h.active, false); assert.equal(h.timers, 0);
});

test('startup health timeout is a failure and never a saved recording', async () => {
  const h = harness();
  const result = h.capture(protocol, new AbortController().signal, new AbortController().signal, () => {});
  const rejected = assert.rejects(result, /Fresh motion readings/);
  await settle(); h.advance(3000); await rejected;
  assert.equal(h.active, false); assert.equal(h.timers, 0);
});

test('data capacity failures do not return a completed recording', async () => {
  const h = harness();
  const result = h.capture({ ...protocol, max_samples: 20 }, new AbortController().signal, new AbortController().signal, () => {});
  const rejected = assert.rejects(result, /data limit/);
  await settle(); for (let i = 1; i <= 40; i++) h.emit(i * 20);
  await rejected; assert.equal(h.active, false); assert.equal(h.timers, 0);
});

test('denied permission never subscribes', async () => {
  const h = harness({ granted: false });
  await assert.rejects(h.capture(protocol, new AbortController().signal, new AbortController().signal, () => {}), /Allow motion access/);
  assert.equal(h.active, false); assert.equal(h.timers, 0);
});
