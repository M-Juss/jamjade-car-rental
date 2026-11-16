import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const settle = () => new Promise(resolve => setImmediate(resolve));
const consent = { consent: true, consent_version: 3, sharing_mode: 'foreground' };

function harness({ phase = 'idle', motionActive = false, pending = [], motionFails = false } = {}) {
  const slots = [];
  const effects = [];
  const intervals = new Set();
  let cursor = 0;
  let scheduled = false;
  let result;
  let focused = true;
  let accessLost = false;
  let ended = false;
  let releaseStart;
  let holdStart = false;
  let nativeStatus = { active: motionActive, booking_code: 'BK-1', unfinished: pending };
  const calls = [];
  const appState = { currentState: 'active', addEventListener: () => ({ remove() {} }) };
  const monitoring = {
    sharing: { phase }, loading: false,
    snapshot: { canMonitor: true, policy: { consentVersion: 3 } },
    refresh: async () => monitoring.snapshot,
    start: async () => { calls.push('gps-start'); },
    stop: async () => { calls.push('gps-stop'); monitoring.sharing.phase = 'paused'; schedule(); },
  };

  function schedule() {
    if (scheduled || !focused) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; render(); });
  }

  function effect(callback, dependencies) {
    const index = cursor++;
    const previous = slots[index];
    if (previous && dependencies?.every((value, position) => Object.is(value, previous.dependencies[position]))) return;
    slots[index] = { dependencies, cleanup: previous?.cleanup };
    effects.push(() => {
      slots[index].cleanup?.();
      slots[index].cleanup = callback();
    });
  }

  const react = {
    useRef(initial) { const index = cursor++; slots[index] ??= { current: initial }; return slots[index]; },
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: initial };
      return [slots[index].value, value => {
        const next = typeof value === 'function' ? value(slots[index].value) : value;
        if (!Object.is(next, slots[index].value)) { slots[index].value = next; schedule(); }
      }];
    },
    useEffect: effect,
    useMemo(factory, dependencies) {
      const index = cursor++;
      if (!slots[index] || dependencies.some((value, position) => !Object.is(value, slots[index].dependencies[position]))) {
        slots[index] = { value: factory(), dependencies };
      }
      return slots[index].value;
    },
    useCallback(callback, dependencies) { return react.useMemo(() => callback, dependencies); },
  };
  const dependencies = {
    react,
    'react-native': { AppState: appState },
    '@react-navigation/native': { useFocusEffect: callback => effect(callback, [callback]) },
    './useLocationMonitoring': { useRentalLocationMonitoring: () => monitoring },
    '@/lib/telematics/release-monitoring': { ReleaseMonitoringPreparation: class { clear() {} } },
    '@/services/telematics/location-sharing-consent': { getLocationSharingConsent: async () => consent },
    '@/services/telematics/location-monitoring-session': {
      isLocationSharingActive: value => ['starting', 'waiting', 'sharing', 'reconnecting'].includes(value),
    },
    '@/services/telematics/rental-drive-monitoring': {
      rentalMotionStatus: async () => nativeStatus,
      pauseRentalDriveMonitoring: async () => { calls.push('motion-stop'); nativeStatus = { ...nativeStatus, active: false }; },
      beginRentalDriveMonitoring: async (owner, booking, isCurrent) => {
        calls.push('motion-start');
        assert.equal(owner, 7);
        assert.equal(booking, 'BK-1');
        if (holdStart) await new Promise(resolve => { releaseStart = resolve; });
        if (!isCurrent()) { calls.push('motion-cancelled'); return; }
        if (motionFails) throw new Error('Motion unavailable');
        nativeStatus = { ...nativeStatus, active: true };
      },
    },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./useTelematicsMonitoring.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, require: name => { assert(name in dependencies, name); return dependencies[name]; },
    setInterval: callback => { intervals.add(callback); return callback; },
    clearInterval: callback => intervals.delete(callback),
  });
  const handover = { eligibility: { state: 'released' }, calibration: { profile: { id: 'rc_demo', fingerprint: 'profile' } } };
  function render() {
    cursor = 0;
    handover.eligibility.state = ended ? 'rental_ended' : 'released';
    result = exports.useTelematicsMonitoring('BK-1', 7, handover, false, accessLost);
    while (effects.length) effects.shift()();
  }
  render();
  return {
    calls,
    get current() { return result; },
    start: () => result.start('BK-1', consent, true),
    setPhase(value) { monitoring.sharing.phase = value; render(); },
    holdMotionStart() { holdStart = true; },
    finishMotionStart: () => releaseStart(),
    denyAccess() { accessLost = true; render(); },
    endRental() { ended = true; render(); },
    tick: () => { for (const callback of intervals) callback(); },
    leave() { focused = false; for (const slot of slots) slot?.cleanup?.(); },
  };
}

test('starts motion without waiting for GPS and keeps it active through GPS failure and reconnect', async () => {
  const h = harness();
  await settle();
  h.holdMotionStart();
  h.start();
  await settle();
  assert.deepEqual(h.calls, ['gps-start', 'motion-start']);
  h.setPhase('error');
  await settle();
  assert.equal(h.current.motionStarting, true);
  h.finishMotionStart();
  await settle();
  assert.equal(h.current.motionActive, true);
  for (const phase of ['waiting', 'reconnecting', 'error', 'offline']) {
    h.setPhase(phase);
    await settle();
    assert.equal(h.current.motionActive, true);
    assert.equal(h.calls.includes('motion-stop'), false);
  }
  h.current.stop();
  await settle();
  assert.deepEqual(h.calls.slice(-2), ['motion-stop', 'gps-stop']);
  h.leave();
});

test('motion failure and pending sync leave the GPS collector running', async () => {
  for (const settings of [{ motionFails: true }, { pending: [{ id: 'old', booking_code: 'BK-1' }] }]) {
    const h = harness(settings);
    await settle();
    h.start();
    h.setPhase('waiting');
    await settle();
    assert.equal(h.current.active, true);
    assert.equal(h.current.motionStarting, false);
    assert(h.current.motionError);
    assert.equal(h.calls.includes('gps-stop'), false);
    h.leave();
  }
});

test('retries only the missing collector without replacing the other runtime', async () => {
  const gps = harness({ phase: 'reconnecting' });
  await settle();
  gps.start();
  await settle();
  assert.deepEqual(gps.calls, ['motion-start']);
  gps.leave();

  const motion = harness({ phase: 'error', motionActive: true });
  await settle();
  motion.start();
  await settle();
  assert.deepEqual(motion.calls, ['gps-start']);
  assert.equal(motion.current.motionActive, true);
  motion.leave();
});

test('Pause, leaving, rental end and access loss cancel delayed motion startup', async () => {
  for (const action of ['pause', 'leave', 'end', 'deny']) {
    const h = harness();
    await settle();
    h.holdMotionStart();
    h.start();
    h.start();
    await settle();
    assert.equal(h.calls.filter(call => call === 'motion-start').length, 1);
    if (action === 'pause') h.current.stop();
    if (action === 'leave') h.leave();
    if (action === 'end') h.endRental();
    if (action === 'deny') h.denyAccess();
    h.finishMotionStart();
    await settle();
    assert(h.calls.includes('motion-cancelled'));
    if (action !== 'leave') assert(h.calls.includes('gps-stop'));
    if (action !== 'leave') h.leave();
  }
});
