import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { CalibrationAccumulator, movementCaptureComplete, rotationAxes, stationaryWithinRange } from '../../lib/telematics/calibration.ts';

function captureHarness({ available = true, granted = true, platform = 'android' } = {}) {
  let listener, stateListener, clock = 0, removed = 0, nextTimer = 0;
  const timers = new Map();
  const source = readFileSync(new URL('./calibration-capture.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [Date.UTC(2026, 9, 17) + clock])); } }
  vm.runInNewContext(compiled, {
    exports, Date: ClockDate, AbortController, Error, Promise,
    performance: { now: () => clock },
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, at: clock + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    require(name) {
      if (name === 'expo-sensors') return { DeviceMotion: {
        isAvailableAsync: async () => available, getPermissionsAsync: async () => ({ granted }), setUpdateInterval() {},
        addListener(callback) { listener = callback; return { remove() { removed++; listener = null; } }; },
      } };
      if (name === 'react-native') return { Platform: { OS: platform }, AppState: {
        currentState: 'active', addEventListener(_, callback) { stateListener = callback; return { remove() { stateListener = null; } }; },
      } };
      if (name.endsWith('/calibration')) return { CalibrationAccumulator, movementCaptureComplete, rotationAxes, stationaryWithinRange };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  function advance(time) {
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= time).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      clock = due[1].at; timers.delete(due[0]); due[1].callback();
    }
    clock = time;
  }
  return {
    capture: exports.captureCalibration, advance,
    emit(time, timestamp = 1 + time / 1000, values = {}) {
      advance(time);
      listener?.({
        acceleration: { x: 0, y: 0, z: 0, ...values.acceleration, timestamp },
        accelerationIncludingGravity: {
          x: (values.acceleration?.x ?? 0) + (values.gravity?.x ?? 0),
          y: (values.acceleration?.y ?? 0) + (values.gravity?.y ?? -9.80665),
          z: (values.acceleration?.z ?? 0) + (values.gravity?.z ?? 0), timestamp,
        },
        rotationRate: { alpha: 0, beta: 0, gamma: 0, ...values.rotation, timestamp },
      });
    },
    background() { stateListener?.('background'); },
    get active() { return Boolean(listener); }, get removed() { return removed; }, get timers() { return timers.size; },
  };
}
const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

const stationaryWindow = {
  limits: { linearRms: 0.35, rotationPeak: 6, yawDegrees: 5, tiltDegrees: 10, maxGapMs: 500 },
  accepts: summary => summary.sensor_duration_ms >= 5950 && summary.sample_count >= 48,
};

test('resume waits through sustained movement and resets for a new full steady window', async () => {
  const harness = captureHarness();
  const readings = [];
  const result = harness.capture(6, null, new AbortController().signal, { stationaryWindow, onReading: reading => readings.push(reading) });
  await settle();
  for (let time = 50; time <= 35000; time += 50) harness.emit(time, undefined, { acceleration: { x: 1 } });
  assert.equal(harness.active, true);
  assert.ok(readings.every(reading => reading.elapsedMs === 0));
  for (let time = 35050; time < 38000; time += 50) harness.emit(time);
  assert.ok(readings.some(reading => reading.elapsedMs > 2000));
  harness.emit(38000, undefined, { rotation: { alpha: 20 } });
  assert.equal(readings.at(-1).elapsedMs, 0);
  for (let time = 38050; time <= 44000; time += 50) harness.emit(time);
  assert.equal(harness.active, true);
  harness.emit(44050);
  const summary = await result;
  assert.equal(Date.parse(summary.ended_at) - Date.parse(summary.started_at), 6000);
  assert.equal(summary.rotation_peak, 0);
  assert.equal(harness.active, false);
  assert.equal(harness.timers, 0);
});

test('resume still stops when the stream stalls or the operator cancels', async () => {
  for (const cancel of [false, true]) {
    const harness = captureHarness();
    const controller = new AbortController();
    const result = harness.capture(6, null, controller.signal, { stationaryWindow });
    const rejected = assert.rejects(result, cancel ? /paused/ : /did not stabilize/);
    await settle();
    for (let time = 50; time <= 500; time += 50) harness.emit(time);
    if (cancel) controller.abort();
    else harness.advance(3500);
    await rejected;
    assert.equal(harness.active, false);
    assert.equal(harness.timers, 0);
  }
});

test('unsupported runtimes cannot subscribe to calibration motion', async () => {
  for (const platform of ['ios', 'web']) {
    const harness = captureHarness({ platform });
    await assert.rejects(harness.capture(6, null, new AbortController().signal), /Android/);
    assert.equal(harness.active, false);
    assert.equal(harness.timers, 0);
  }
});

const forwardLimits = { acceleration: 0.5, durationMs: 250, coherence: 0.7, samples: 5 };
function movementOptions(step) {
  return { forwardLimits, completion: { step,
    quality: { minimumDurationMs: 1000, minimumCoverage: 0.85, minimumSamplesPerSecond: 8 }, maxGapMs: 500,
    movement: { tiltDegrees: 60, rotationPeak: 120, yawDegrees: 45, forwardAccelerationOnly: false, brakingAcceleration: 0.5, turnDegrees: 10, oppositeTurnDegrees: 20, turnDominance: 1.5 },
  } };
}

for (const platform of ['android']) for (const accelerationOnly of [false, true]) {
  test(`${platform}: Forward capture accepts acceleration-only setting ${accelerationOnly}`, async () => {
    const harness = captureHarness({ platform });
    const options = movementOptions('forward_calibration');
    options.forwardLimits = { ...forwardLimits, acceleration: 3 };
    options.completion.movement.forwardAccelerationOnly = accelerationOnly;
    const result = harness.capture(3, { down: [0, -1, 0], forward: null }, new AbortController().signal, options);
    await settle();
    for (let time = 50; time <= 3250; time += 50) harness.emit(time, undefined, {
      acceleration: { z: -3.02 }, rotation: { beta: accelerationOnly ? 55.51 : 0 },
    });
    const summary = await result;
    assert.ok(Date.parse(summary.ended_at) - Date.parse(summary.started_at) < 3000);
    assert.ok(Math.abs(summary.forward_z) >= 3);
    assert.equal(harness.active, false);
    assert.equal(harness.timers, 0);
  });
}

test('invalid movement settings fail before any motion subscription', async () => {
  for (const override of [{ forwardAccelerationOnly: 'true' }, { rotationPeak: NaN }, { tiltDegrees: Infinity }]) {
    const harness = captureHarness();
    const options = movementOptions('forward_calibration');
    Object.assign(options.completion.movement, override);
    await assert.rejects(harness.capture(3, { down: [0, -1, 0], forward: null }, new AbortController().signal, options), /settings/);
    assert.equal(harness.active, false);
    assert.equal(harness.timers, 0);
  }
});

for (const platform of ['android']) for (const peak of [2.99, 3, 3.02]) {
  test(`${platform}: Forward retains one ${peak} acceleration peak through later fluctuations`, async () => {
    const harness = captureHarness({ platform });
    const options = movementOptions('forward_calibration');
    options.forwardLimits = { acceleration: 3, durationMs: 0, samples: 1, coherence: 0.9 };
    options.completion.movement.rotationPeak = 60;
    options.completion.movement.yawDegrees = 180;
    const readings = [];
    options.onReading = (reading) => readings.push(reading);
    const result = harness.capture(3, { down: [0, -1, 0], forward: null }, new AbortController().signal, options);
    await settle();
    for (let time = 50; time <= 3250; time += 50) harness.emit(time, undefined, {
      acceleration: { z: time === 450 ? -peak : time % 100 === 0 ? 0.2 : -0.1 },
      rotation: { beta: 55.51 },
    });
    const summary = await result;
    const qualified = peak >= 3;
    assert.equal(Date.parse(summary.ended_at) - Date.parse(summary.started_at), qualified ? 1000 : 3000);
    assert.equal(summary.forward_sample_count, qualified ? 1 : 0);
    assert.equal(summary.forward_duration_ms, 0);
    assert.equal(summary.forward_z, qualified ? -peak : 0);
    if (qualified) {
      assert.ok(readings.some((reading) => reading.forward.acceleration < 3 && reading.forward.meanAcceleration >= 3));
    }
    assert.equal(harness.active, false);
    assert.equal(harness.timers, 0);
  });
}

for (const platform of ['android']) for (const step of ['forward_calibration', 'braking_calibration', 'left_turn_calibration', 'right_turn_calibration']) {
  test(`${platform}: ${step} finishes on valid evidence before the maximum recording time`, async () => {
    const harness = captureHarness({ platform });
    const reference = { down: [0, -1, 0], forward: step === 'forward_calibration' ? null : [0, 0, -1] };
    const result = harness.capture(3, reference, new AbortController().signal, movementOptions(step));
    await settle();
    for (let time = 50; time <= 3250; time += 50) harness.emit(time, undefined,
      step.endsWith('turn_calibration') ? { rotation: { beta: step === 'left_turn_calibration' ? 20 : -20 } }
        : { acceleration: { z: step === 'forward_calibration' ? -0.8 : 0.8 } });
    const summary = await result;
    const duration = Date.parse(summary.ended_at) - Date.parse(summary.started_at);
    assert.ok(duration >= 1000 && duration < 3000);
    assert.ok(summary.sensor_duration_ms >= duration * 0.85);
    assert.ok(summary.sample_count >= duration / 1000 * 8);
    assert.equal(harness.active, false);
    assert.equal(harness.timers, 0);
  });
}

test('missing or opposite movement waits for the timeout instead of completing early', async () => {
  for (const opposite of [false, true]) {
    const harness = captureHarness();
    const result = harness.capture(3, { down: [0, -1, 0], forward: [0, 0, -1] }, new AbortController().signal, movementOptions('left_turn_calibration'));
    await settle();
    for (let time = 50; time <= 3250; time += 50) harness.emit(time, undefined, { rotation: { beta: opposite ? -20 : 0 } });
    const summary = await result;
    assert.equal(Date.parse(summary.ended_at) - Date.parse(summary.started_at), 3000);
    assert.equal(summary.yaw_left_degrees, 0);
    assert.equal(harness.timers, 0);
  }
});

test('a gap or changed mount prevents early completion despite later qualifying movement', async () => {
  for (const changedMount of [false, true]) {
    const harness = captureHarness();
    const result = harness.capture(3, { down: [0, -1, 0], forward: [0, 0, -1] }, new AbortController().signal, movementOptions('braking_calibration'));
    await settle();
    for (let time = 50; time <= 3250; time += 50) {
      if (!changedMount && time > 500 && time < 1200) continue;
      harness.emit(time, undefined, { acceleration: { z: 0.8 }, ...(changedMount ? { gravity: { y: 0, z: -9.80665 } } : {}) });
    }
    const summary = await result;
    assert.equal(Date.parse(summary.ended_at) - Date.parse(summary.started_at), 3000);
    assert.ok(changedMount ? summary.max_tilt_degrees > 60 : summary.max_gap_ms > 500);
  }
});

for (const platform of ['android']) test(`${platform}: fresh startup provides a full capture and throttled aggregate feedback`, async () => {
  const harness = captureHarness({ platform });
  let ready = 0; const readings = [];
  const result = harness.capture(3, null, new AbortController().signal, { onReady() { ready++; }, onReading(value) { readings.push(value); } });
  await settle();
  for (let i = 1; i <= 64; i++) harness.emit(i * 50);
  harness.advance(3250);
  const summary = await result;
  assert.equal(ready, 1);
  assert.equal(Date.parse(summary.ended_at) - Date.parse(summary.started_at), 3000);
  assert.equal(summary.sample_count, 60);
  assert.ok(Math.abs(summary.sensor_duration_ms - 2950) < 0.001);
  assert.equal(summary.samples, undefined);
  assert.ok(readings.length >= 14 && readings.length <= 16);
  assert.deepEqual(Object.keys(readings[0]).sort(), ['acceleration', 'durationMs', 'elapsedMs', 'maxGapMs', 'rotation', 'tilt', 'yaw']);
  assert.equal(harness.active, false); assert.equal(harness.removed, 1); assert.equal(harness.timers, 0);
});

test('cached startup packet cannot inflate the next capture with the previous attempt gap', async () => {
  const harness = captureHarness();
  const result = harness.capture(3, null, new AbortController().signal);
  await settle();
  harness.emit(50, 1); // Cached event from nine seconds earlier.
  for (let i = 2; i <= 65; i++) harness.emit(i * 50, 10 + i / 20);
  harness.advance(3300);
  const summary = await result;
  assert.ok(summary.sensor_duration_ms < 3001);
  assert.ok(summary.max_gap_ms < 51);
  assert.equal(Date.parse(summary.ended_at) - Date.parse(summary.started_at), 3000);
});

test('a real gap after startup remains in the quality evidence', async () => {
  const harness = captureHarness();
  const result = harness.capture(3, null, new AbortController().signal);
  await settle();
  for (let i = 1; i <= 10; i++) harness.emit(i * 50);
  harness.emit(1500);
  for (let i = 31; i < 65; i++) harness.emit(i * 50);
  harness.advance(3250);
  assert.ok((await result).max_gap_ms >= 999);
});

test('no readings and repeated cached timestamps time out without announcing recording', async () => {
  for (const cached of [false, true]) {
    const harness = captureHarness(); let ready = false;
    const result = harness.capture(3, null, new AbortController().signal, { onReady() { ready = true; } });
    const rejected = assert.rejects(result, /did not stabilize/);
    await settle();
    if (cached) for (let i = 1; i < 60; i++) harness.emit(i * 50, 1);
    harness.advance(3000); await rejected;
    assert.equal(ready, false); assert.equal(harness.active, false); assert.equal(harness.timers, 0);
  }
});

test('cancellation and backgrounding release resources during startup and capture', async () => {
  for (const warmed of [false, true]) for (const background of [false, true]) {
    const harness = captureHarness(); const controller = new AbortController();
    const result = harness.capture(3, null, controller.signal);
    const rejected = assert.rejects(result, /paused/);
    await settle();
    if (warmed) for (let i = 1; i <= 6; i++) harness.emit(i * 50);
    if (background) harness.background(); else controller.abort();
    await rejected;
    assert.equal(harness.active, false); assert.equal(harness.removed, 1); assert.equal(harness.timers, 0);
  }
});

test('missing motion permission never subscribes or invents evidence', async () => {
  const harness = captureHarness({ granted: false });
  await assert.rejects(harness.capture(3, null, new AbortController().signal), /Motion access/);
  assert.equal(harness.active, false); assert.equal(harness.removed, 0);
});


for (const platform of ['android']) test(`${platform}: parked measurement includes fluctuations without censoring or resetting the window`, async () => {
  const harness = captureHarness({ platform });
  const readings = [];
  const result = harness.capture(3, null, new AbortController().signal, { onReading(value) { readings.push(value); } });
  await settle();
  for (let i = 1; i <= 64; i++) harness.emit(i * 50, undefined, { acceleration: { x: i === 30 ? 0.8 : i % 2 ? 0.3 : -0.3 }, rotation: { alpha: i % 2 ? 1 : -1 } });
  harness.advance(3250);
  const summary = await result;
  assert.equal(Date.parse(summary.ended_at) - Date.parse(summary.started_at), 3000);
  assert.equal(summary.sample_count, 60);
  assert.ok(summary.linear_rms > 0.3); // The spike was measured, not silently removed.
  assert.ok(Math.abs(summary.horizontal_rms - summary.linear_rms) < 0.001);
  assert.ok(summary.linear_stddev > 0.29);
  assert.ok(Math.abs(summary.rotation_rms - 1) < 0.001);
  assert.ok(readings.every((reading, i) => i === 0 || reading.elapsedMs > readings[i - 1].elapsedMs));
  assert.equal(harness.timers, 0);
});

test('parked bias and variation remain separate bounded statistics', async () => {
  const harness = captureHarness();
  const result = harness.capture(3, null, new AbortController().signal);
  await settle();
  for (let i = 1; i <= 64; i++) harness.emit(i * 50, undefined, { acceleration: { x: 0.1 }, rotation: { alpha: 0.5 } });
  harness.advance(3250);
  const summary = await result;
  assert.ok(Math.abs(summary.linear_mean_x - 0.1) < 0.00001);
  assert.ok(summary.linear_stddev < 0.00001);
  assert.ok(Math.abs(summary.rotation_mean_x - 0.5) < 0.00001);
  assert.ok(summary.rotation_stddev < 0.00001);
  assert.equal(summary.samples, undefined);
});

for (const platform of ['android']) test(`${platform}: Forward live feedback uses the horizontal plane and retains the learned window after stopping`, async () => {
  const harness = captureHarness({ platform });
  const readings = [];
  const result = harness.capture(3, { down: [0, -1, 0], forward: null }, new AbortController().signal, { onReading(value) { readings.push(value); } });
  await settle();
  for (let time = 50; time <= 3250; time += 50) harness.emit(time, undefined, { acceleration: { y: 0.1, z: time >= 600 && time <= 1500 ? -0.8 : 0 } });
  const summary = await result;
  const moving = readings.find(value => value.forward.acceleration > 0.7);
  assert.ok(moving);
  assert.ok(Math.abs(moving.forward.acceleration - 0.8) < 0.001); // Vertical vibration is excluded.
  const stopped = readings.at(-1).forward;
  assert.equal(stopped.acceleration, 0);
  assert.ok(Math.abs(stopped.meanAcceleration - 0.8) < 0.001);
  assert.ok(stopped.durationMs >= 500);
  assert.ok(stopped.coherence >= 0.99);
  assert.ok(stopped.samples >= 5);
  assert.equal(summary.forward, undefined); // Presentation-only data never enters evidence.
  assert.equal(Date.parse(summary.ended_at) - Date.parse(summary.started_at), 3000);
  assert.equal(harness.timers, 0);
});

test('Forward learner uses the server threshold instead of its default floor', async () => {
  for (const acceleration of [0.8, 1.1]) {
    const harness = captureHarness();
    const result = harness.capture(3, { down: [0, -1, 0], forward: null }, new AbortController().signal, { forwardLimits: { acceleration: 0.9, durationMs: 500, coherence: 0.9, samples: 5 } });
    await settle();
    for (let time = 50; time <= 3250; time += 50) harness.emit(time, undefined, { acceleration: { z: time >= 600 && time <= 1500 ? acceleration : 0 } });
    harness.advance(3250);
    const summary = await result;
    assert.equal(summary.forward_duration_ms >= 500, acceleration > 0.9);
    assert.equal(harness.timers, 0);
  }
});

for (const platform of ['android']) test(`${platform}: noisy Forward candidates reset live progress before a clean movement is retained`, async () => {
  const harness = captureHarness({ platform });
  const readings = [];
  const result = harness.capture(3, { down: [0, -1, 0], forward: null }, new AbortController().signal, { onReading(value) { readings.push(value); } });
  await settle();
  for (let time = 50; time <= 3250; time += 50) {
    const noise = time >= 300 && time < 1450;
    harness.emit(time, undefined, { acceleration: { x: noise ? (time % 100 ? -1 : 1) : 0, z: time >= 1450 && time < 2750 ? -0.8 : 0 } });
  }
  const summary = await result;
  assert.ok(readings.some((value, index) => index > 0 && value.forward.durationMs < readings[index - 1].forward.durationMs));
  assert.ok(Math.abs(summary.forward_z + 0.8) < 1e-9);
  assert.ok(Math.abs(summary.forward_x) < 1e-9);
  assert.ok(summary.forward_coherence > 0.99);
  assert.equal(summary.sample_count, 60);
  assert.equal(harness.active, false);
  assert.equal(harness.timers, 0);
});

test('invalid server window settings fail before any motion subscription', async () => {
  for (const override of [{ acceleration: NaN }, { coherence: 1.01 }, { durationMs: 1001 }, { samples: 1.5 }]) {
    const harness = captureHarness();
    await assert.rejects(harness.capture(3, { down: [0, -1, 0], forward: null }, new AbortController().signal, { forwardLimits: { acceleration: 0.5, durationMs: 500, coherence: 0.9, samples: 5, ...override } }), /settings/);
    assert.equal(harness.active, false);
    assert.equal(harness.timers, 0);
  }
});

for (const platform of ['android']) test(`${platform}: short mounted recordings expose real braking and separate turn totals without new payload fields`, async () => {
  const harness = captureHarness({ platform });
  const readings = [];
  const result = harness.capture(3, { down: [0, -1, 0], forward: [0, 0, -1] }, new AbortController().signal,
    { onReading: (value) => readings.push(value) });
  await settle();
  for (let i = 1; i <= 64; i++) harness.emit(i * 50, 1 + i / 20, { acceleration: { z: 0.8 }, rotation: { beta: 6 } });
  harness.advance(3250);
  const summary = await result;
  assert.ok(readings.at(-1).movement.braking > 0.79);
  assert.ok(readings.at(-1).movement.leftDegrees > 10);
  assert.equal(readings.at(-1).movement.rightDegrees, 0);
  assert.equal(summary.movement, undefined);
  assert.equal(summary.samples, undefined);
  assert.equal(harness.active, false);
});
