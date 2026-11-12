import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(file, imports = {}, globals = {}) {
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => imports[name] ?? require(name), Date, Error, AbortController, setTimeout, clearTimeout, ...globals });
  return exports;
}
const schemas = load('../../validation/telematics/location-monitoring.ts');
const policy = { consentVersion: 2, uploadIntervalSeconds: 5, maximumAccuracyMeters: 50, maximumAgeSeconds: 60, futureSkewSeconds: 10, retentionHours: 24 };
const consent = { consent: true, consent_version: 2, sharing_mode: 'foreground' };
const flush = async () => { for (let index = 0; index < 30; index++) await Promise.resolve(); };

function harness(overrides = {}) {
  let now = Date.parse('2026-10-18T04:00:00Z');
  let reading, failure, tick;
  let removes = 0;
  const starts = [], updates = [], pauses = [], watches = [];
  let snapshot = { bookingCode: 'DEMO', canMonitor: true, tripStatus: null, lastLocationAt: null, policy };
  const { LocationMonitoringSession, LocationMonitoringIssue } = load('./location-monitoring-session.ts', {
    '../../validation/telematics/location-monitoring': schemas,
  }, { setInterval: (callback) => { tick = callback; return 1; }, clearInterval: () => { tick = null; } });
  const deps = {
    read: async () => snapshot,
    start: async (code, fix, values, limits, signal) => {
      starts.push({ code, fix, values, limits, signal });
      snapshot = { ...snapshot, tripStatus: 'started', lastLocationAt: fix.captured_at };
      return { ...snapshot, sessionToken: 'a'.repeat(64) };
    },
    update: async (code, fix, token) => { updates.push({ code, fix, token }); snapshot = { ...snapshot, lastLocationAt: fix.captured_at }; return snapshot; },
    pause: async (code, token, signal, reason) => { pauses.push({ code, token, reason }); snapshot = { ...snapshot, tripStatus: 'paused' }; },
    prepare: async () => {},
    watch: async (interval, onReading, onFailure) => { watches.push(interval); reading = onReading; failure = onFailure; return { remove: () => { removes++; } }; },
    foreground: () => true, connected: async () => true, now: () => now, ...overrides,
  };
  const session = new LocationMonitoringSession(deps);
  return {
    session, deps, starts, updates, pauses, watches, LocationMonitoringIssue,
    get removes() { return removes; },
    setSnapshot: (changes) => { snapshot = { ...snapshot, ...changes }; },
    advance: (ms) => { now += ms; },
    send: async (changes = {}) => { reading({ latitude: 14, longitude: 121, accuracy: 5, captured_at: new Date(now).toISOString(), ...changes }); await flush(); },
    tick: async () => { tick?.(); await flush(); },
    fail: async () => { failure(); await flush(); },
  };
}

test('no watcher, request or mutation starts without explicit valid consent', async () => {
  const h = harness({ read: async () => assert.fail('Must not read without consent') });
  for (const values of [{}, { ...consent, consent: false }]) await assert.rejects(h.session.start('DEMO', values));
  assert.equal(h.watches.length, 0);
});

test('the map receives only a valid current fix and drops it on invalid evidence, stop and account reset', async () => {
  const h = harness();
  await h.session.start('DEMO', consent);
  assert.equal(h.session.getSnapshot().latestFix, null);
  await h.send();
  assert.equal(h.session.getSnapshot().latestFix.latitude, 14);
  await h.send({ accuracy: 500 });
  assert.equal(h.session.getSnapshot().latestFix, null);
  h.advance(5000);
  await h.send();
  assert.equal(h.session.getSnapshot().latestFix.latitude, 14);
  await h.session.stop();
  assert.equal(h.session.getSnapshot().latestFix, null);
  assert.equal(h.pauses.at(-1).reason, 'manual');
  await h.session.reset();
  assert.equal(h.session.getSnapshot().bookingCode, null);
});

test('an interruption uses the authenticated pause path so its in-app notice has an explicit reason', async () => {
  const h = harness();
  await h.session.start('DEMO', consent);
  await h.send();
  await h.fail();
  assert.equal(h.session.getSnapshot().phase, 'error');
  assert.equal(h.session.getSnapshot().latestFix, null);
  assert.equal(h.pauses.at(-1).reason, 'interrupted');
});

test('a released rental and valid first GPS fix precede the first upload; no speed or motion is sent', async () => {
  const h = harness();
  await h.session.start('DEMO', consent);
  assert.equal(h.session.getSnapshot().phase, 'waiting');
  assert.equal(h.starts.length, 0);
  await h.send();
  assert.equal(h.starts.length, 1);
  assert.deepEqual(Object.keys(h.starts[0].fix), ['latitude', 'longitude', 'accuracy', 'captured_at']);
  assert.equal(h.session.getSnapshot().phase, 'sharing');
  h.advance(5000);
  await h.send({ latitude: 14.001 });
  assert.equal(h.updates.length, 1);
  assert.equal(h.updates[0].token, 'a'.repeat(64));
  h.session.reset();
});

test('poor, stale, nonfinite and future GPS fixes never create a trip', async () => {
  const h = harness();
  await h.session.start('DEMO', consent);
  for (const bad of [{ accuracy: null }, { accuracy: 51 }, { latitude: Infinity }, { captured_at: '2026-10-18T03:58:00Z' }, { captured_at: '2026-10-18T03:59:59Z' }, { captured_at: '2026-10-18T04:00:11Z' }]) await h.send(bad);
  assert.equal(h.starts.length, 0);
  h.advance(31000);
  await h.tick();
  assert.equal(h.session.getSnapshot().phase, 'error');
  assert.equal(h.removes, 1);
});

test('uploads are bounded and intermediate points are replaced by the latest point', async () => {
  const h = harness();
  await h.session.start('DEMO', consent);
  await h.send();
  for (let index = 1; index <= 4; index++) { h.advance(1000); await h.send({ latitude: 14 + index / 1000 }); }
  assert.equal(h.updates.length, 0);
  h.advance(1000);
  await h.tick();
  assert.equal(h.updates.length, 1);
  assert.equal(h.updates[0].fix.latitude, 14.004);
  h.session.reset();
});

test('offline startup needs a new explicit start', async () => {
  let online = false;
  const h = harness({ connected: async () => online });
  await h.session.start('DEMO', consent);
  assert.equal(h.watches.length, 0);
  assert.equal(h.session.getSnapshot().phase, 'offline');
  online = true;
  await h.tick();
  assert.equal(h.updates.length, 0);
  assert.equal(h.session.getSnapshot().phase, 'offline');
  h.session.connectionRestored('OTHER');
  assert.equal(h.session.getSnapshot().phase, 'offline');
  h.session.connectionRestored('DEMO');
  assert.equal(h.session.getSnapshot().phase, 'paused');
  assert.equal(h.session.getSnapshot().message, null);
  assert.equal(h.watches.length, 0);
  h.session.reset();
});

test('a foreground outage keeps the watcher and sends only the newest fix on reconnect', async () => {
  let online = true;
  const h = harness({ connected: async () => online });
  await h.session.start('DEMO', consent);
  await h.send();
  online = false;
  h.advance(5000);
  await h.send({ latitude: 14.001 });
  assert.equal(h.session.getSnapshot().phase, 'reconnecting');
  h.advance(2000);
  await h.send({ latitude: 14.002 });
  assert.equal(h.removes, 0);
  assert.equal(h.pauses.length, 0);
  assert.equal(h.updates.length, 0);
  const fix = h.session.getSnapshot().latestFix;
  online = true;
  h.advance(3000);
  await h.tick();
  assert.equal(h.updates.length, 1);
  assert.equal(h.updates[0].fix.latitude, 14.002);
  assert.equal(h.updates[0].fix.captured_at, fix.captured_at);
  assert.equal(h.session.getSnapshot().phase, 'sharing');
  assert.equal(h.starts.length, 1);
  h.session.reset();
});

test('a failed upload retains its fix and rechecks authorization before retrying', async () => {
  const attempts = [];
  let allowed = true;
  const h = harness({
    read: async () => ({ canMonitor: allowed, tripStatus: 'started', policy }),
    update: async (_code, fix) => {
      attempts.push(fix);
      if (attempts.length === 1 || attempts.length === 3) throw { status: 0 };
      return { lastLocationAt: fix.captured_at };
    },
  });
  await h.session.start('DEMO', consent);
  await h.send();
  h.advance(5000);
  await h.send();
  assert.equal(h.session.getSnapshot().phase, 'reconnecting');
  h.advance(5000);
  await h.tick();
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].captured_at, attempts[1].captured_at);
  assert.equal(h.session.getSnapshot().phase, 'sharing');
  h.advance(5000);
  await h.send();
  assert.equal(h.session.getSnapshot().phase, 'reconnecting');
  allowed = false;
  h.advance(5000);
  await h.tick();
  assert.equal(attempts.length, 3);
  assert.equal(h.session.getSnapshot().phase, 'paused');
});

test('manual pause during an outage prevents automatic upload', async () => {
  let online = true;
  const h = harness({ connected: async () => online });
  await h.session.start('DEMO', { ...consent, sharing_mode: 'foreground_background' });
  await h.send(); online = false;
  h.advance(5000); await h.send();
  assert.equal(h.session.getSnapshot().phase, 'reconnecting');
  await h.session.stop(); online = true;
  h.advance(5000); await h.session.onAppStateChange(true);
  assert.equal(h.session.getSnapshot().phase, 'paused');
  assert.equal(h.session.getSnapshot().latestFix, null);
  assert.equal(h.removes, 1);
  assert.equal(h.updates.length, 0);
  assert.equal(h.pauses.at(-1).reason, 'manual');
});

test('a consented background session reconnects with only the newest fix', async () => {
  let online = true, foreground = true;
  const h = harness({ connected: async () => online, foreground: () => foreground });
  await h.session.start('DEMO', { ...consent, sharing_mode: 'foreground_background' });
  await h.send(); online = false;
  h.advance(5000); await h.send({ latitude: 14.001 });
  foreground = false; await h.session.onAppStateChange(false);
  assert.equal(h.session.canContinueInBackground(), true);
  h.advance(2000); await h.send({ latitude: 14.002 });
  online = true; h.advance(3000); await h.tick();
  assert.equal(h.updates.length, 1);
  assert.equal(h.updates[0].fix.latitude, 14.002);
  assert.equal(h.session.getSnapshot().phase, 'sharing');
  assert.equal(h.removes, 0);
  await h.session.reset();
});

test('foreground-only sharing still stops when backgrounded during an outage', async () => {
  let online = true, foreground = true;
  const h = harness({ connected: async () => online, foreground: () => foreground });
  await h.session.start('DEMO', consent);
  await h.send(); online = false;
  h.advance(5000); await h.send();
  foreground = false; await h.session.onAppStateChange(false);
  online = true; foreground = true;
  h.advance(5000); await h.session.onAppStateChange(true);
  assert.equal(h.session.getSnapshot().phase, 'paused');
  assert.equal(h.removes, 1);
  assert.equal(h.updates.length, 0);
});

test('background reconnect never sends a fix after consent version changes', async () => {
  let online = true, foreground = true;
  const h = harness({ connected: async () => online, foreground: () => foreground });
  await h.session.start('DEMO', { ...consent, sharing_mode: 'foreground_background' });
  await h.send(); online = false; foreground = false;
  h.advance(5000); await h.send();
  h.setSnapshot({ policy: { ...policy, consentVersion: 3 } });
  online = true; h.advance(5000); await h.tick();
  assert.equal(h.session.getSnapshot().phase, 'paused');
  assert.equal(h.updates.length, 0);
  assert.equal(h.removes, 1);
});

test('stop removes the watcher immediately and ignores delayed watcher registration and callbacks', async () => {
  let register;
  let removed = 0;
  const h = harness({ watch: () => new Promise((resolve) => { register = resolve; }) });
  const starting = h.session.start('DEMO', consent);
  await flush();
  h.session.stop('App left the foreground.');
  register({ remove: () => { removed++; } });
  await starting;
  assert.equal(removed, 1);
  assert.equal(h.session.getSnapshot().phase, 'paused');
  assert.equal(h.starts.length, 0);
});

test('a late start response after stopping cannot restart sharing or publish success', async () => {
  let finish;
  const h = harness({ start: () => new Promise((resolve) => { finish = resolve; }) });
  await h.session.start('DEMO', consent);
  await h.send();
  h.session.stop();
  finish({ bookingCode: 'DEMO', canMonitor: true, tripStatus: 'started', lastLocationAt: '2026-10-18T04:00:00Z', sessionToken: 'a'.repeat(64), policy });
  await flush();
  assert.equal(h.session.getSnapshot().phase, 'paused');
  assert.equal(h.session.getSnapshot().lastUploadedAt, null);
  assert.equal(h.removes, 1);
});

test('server receipt or eligibility loss stops an existing watcher on its next check', async () => {
  const h = harness();
  await h.session.start('DEMO', consent);
  await h.send();
  h.setSnapshot({ canMonitor: false, tripStatus: 'ended' });
  h.advance(15000);
  await h.tick();
  assert.equal(h.session.getSnapshot().phase, 'paused');
  assert.equal(h.removes, 1);
  assert.equal(h.updates.length, 0);
});

test('native errors and rejected uploads stop the watcher without exposing raw failures', async () => {
  const h = harness({ start: async () => { throw new Error('private server internals'); } });
  await h.session.start('DEMO', consent);
  await h.send();
  assert.equal(h.session.getSnapshot().phase, 'error');
  assert.equal(h.removes, 1);
  assert.doesNotMatch(h.session.getSnapshot().message, /private/);
  const native = harness();
  await native.session.start('DEMO', consent);
  await native.fail();
  assert.equal(native.removes, 1);
});

test('reset discards the old account and never automatically resumes sharing', async () => {
  const h = harness();
  await h.session.start('DEMO', consent);
  await h.send();
  h.session.reset();
  assert.equal(h.session.getSnapshot().bookingCode, null);
  assert.equal(h.session.getSnapshot().phase, 'idle');
  await h.tick();
  assert.equal(h.starts.length, 1);
});

test('non-editable upload fields and expired consent/session errors receive specific safe recovery', async () => {
  for (const [field, message] of [['consent_version', /terms changed/], ['session_token', /session changed/], ['captured_at', /date and time/], ['accuracy', /accurate GPS/]]) {
    const h = harness({ start: async () => { throw { status: 422, errors: { [field]: ['private backend detail'] } }; } });
    await h.session.start('DEMO', consent);
    await h.send();
    assert.equal(h.session.getSnapshot().phase, 'error');
    assert.match(h.session.getSnapshot().message, message);
    assert.doesNotMatch(h.session.getSnapshot().message, /private/);
  }
});

test('explicit background consent continues uploads while minimized and stops on manual stop', async () => {
  let foreground = true;
  const h = harness({ foreground: () => foreground });
  await h.session.start('DEMO', { ...consent, sharing_mode: 'foreground_background' });
  assert.equal(h.session.canContinueInBackground(), true);
  await h.send();
  foreground = false;
  h.advance(5000);
  await h.send({ latitude: 14.005 });
  assert.equal(h.updates.length, 1);
  assert.equal(h.session.getSnapshot().phase, 'sharing');
  await h.session.stop();
  h.advance(5000); await h.send();
  assert.equal(h.updates.length, 1);
  assert.equal(h.session.canContinueInBackground(), false);
});

test('foreground consent never grants background collection and stopped startup cannot register a session', async () => {
  const h = harness();
  await h.session.start('DEMO', consent);
  assert.equal(h.session.canContinueInBackground(), false);
  await h.session.reset();
  let finish;
  let cleanups = 0;
  const pending = harness({ cleanup: () => cleanups++ === 0 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve() });
  const start = pending.session.start('DEMO', { ...consent, sharing_mode: 'foreground_background' });
  pending.session.stop();
  finish();
  await start;
  assert.equal(pending.watches.length, 0);
});

test('background reconnection rechecks rental eligibility before sharing', async () => {
  let connected = true, foreground = true;
  const h = harness({ connected: async () => connected, foreground: () => foreground });
  await h.session.start('DEMO', { ...consent, sharing_mode: 'foreground_background' });
  await h.send(); foreground = false; connected = false;
  h.advance(5000); await h.send();
  assert.equal(h.session.getSnapshot().phase, 'reconnecting');
  h.setSnapshot({ canMonitor: false, tripStatus: 'ended' });
  connected = true; h.advance(5000); await h.tick();
  assert.equal(h.session.getSnapshot().phase, 'paused');
  assert.equal(h.session.canContinueInBackground(), false);
  assert.equal(h.updates.length, 0);
  assert.equal(h.removes, 1);
});

test('foreground GPS exit reports an interruption rather than manually pausing motion', async () => {
  const h = harness();
  await h.session.start('DEMO', consent);
  await h.send();
  await h.session.stop('Foreground GPS stopped.', 'paused', false, 'interrupted');
  await flush();
  assert.equal(h.pauses.at(-1).reason, 'interrupted');
  assert.equal(h.session.getSnapshot().phase, 'paused');
});
