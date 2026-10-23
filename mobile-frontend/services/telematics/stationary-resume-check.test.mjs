import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { stationaryResumeFailure, stationaryResumeSettingsValid } from '../../lib/telematics/stationary-resume.ts';

const settings = {
  captureSeconds: { stationary_calibration: 6 }, profile: { id: 'standard' },
  stationaryLimits: { linearRms: 0.35, rotationPeak: 6, yawDegrees: 5, tiltDegrees: 10, maxGapMs: 500 },
  completionLimits: { minimumCoverage: 0.85, minimumSamplesPerSecond: 8 },
};
const summary = {
  started_at: '2026-10-19T01:00:00.000Z', ended_at: '2026-10-19T01:00:06.000Z',
  sample_count: 120, sensor_duration_ms: 5950, max_gap_ms: 50, linear_rms: 0.05, rotation_peak: 0.1,
  max_tilt_degrees: 1, yaw_left_degrees: 0.1, yaw_right_degrees: 0.1, gravity_x: 0, gravity_y: -9.81, gravity_z: 0,
};
class CaptureAccessError extends Error { constructor(hardwareAvailable) { super('Unavailable'); this.hardwareAvailable = hardwareAvailable; } }
function harness({ released = true, eligible = true, eligibleAfter = true, changed = {}, cancel = false, failRead = false, denied = false } = {}) {
  const source = readFileSync(new URL('./stationary-resume-check.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}, calls = [], phases = [], request = new AbortController();
  let monitoringReads = 0;
  vm.runInNewContext(compiled, { exports, require(name) {
    if (name.endsWith('/stationary-resume')) return { stationaryResumeFailure, stationaryResumeSettingsValid };
    if (name.endsWith('/telematics.service')) return { getBookingTelematicsSetup: async (code, signal) => {
      assert.equal(signal, request.signal); calls.push('handover');
      if (failRead) throw new Error('private backend details');
      return { bookingCode: code, eligibility: { state: released ? 'released' : 'handover_in_progress' }, calibration: settings };
    } };
    if (name.endsWith('/location-monitoring.service')) return { getLocationMonitoring: async (code, signal) => {
      assert.equal(signal, request.signal); calls.push('monitoring');
      return { canMonitor: ++monitoringReads === 1 ? eligible : eligibleAfter };
    } };
    if (name === './calibration-capture') return { CalibrationCaptureAccessError: CaptureAccessError, captureCalibration: async (seconds, reference, signal, callbacks) => {
      calls.push('capture'); assert.equal(seconds, 6); assert.equal(reference, null); assert.equal(signal, request.signal);
      if (denied) throw new CaptureAccessError(true);
      callbacks.onReading({ elapsedMs: 6000 });
      if (cancel) request.abort();
      return { ...summary, ...changed };
    } };
    throw new Error(`Unexpected mutation or dependency: ${name}`);
  } });
  return { run: () => exports.runStationaryResumeCheck('DEMO', request.signal, () => {}, (live) => phases.push(live.phase)), calls, phases };
}

test('a real passing summary and fresh post-check eligibility allow resume without mutating setup or starting GPS', async () => {
  const h = harness();
  assert.equal(await h.run(), true);
  assert.deepEqual(h.calls, ['handover', 'monitoring', 'capture', 'monitoring']);
  assert.deepEqual(h.phases, ['preparing', 'recording', 'evaluating', 'passed']);
});
test('unreleased or ineligible rentals never subscribe to motion', async () => {
  for (const options of [{ released: false }, { eligible: false }]) {
    const h = harness(options);
    await assert.rejects(h.run(), /no longer available/);
    assert.equal(h.calls.includes('capture'), false);
  }
});
test('unstable capture, cancellation and eligibility loss cannot produce a passing check', async () => {
  const unstable = harness({ changed: { linear_rms: 5 } });
  await assert.rejects(unstable.run(), /not steady/);
  assert.equal(unstable.phases.includes('passed'), false);
  const cancelled = harness({ cancel: true });
  assert.equal(await cancelled.run(), false);
  assert.equal(cancelled.phases.includes('passed'), false);
  const ended = harness({ eligibleAfter: false });
  await assert.rejects(ended.run(), /no longer available/);
  assert.equal(ended.phases.includes('passed'), false);
});
test('read failures show safe recovery copy', async () => {
  await assert.rejects(harness({ failRead: true }).run(), /Rental status could not be checked/);
});
test('revoked motion permission offers Settings without bypassing the check', async () => {
  const h = harness({ denied: true });
  await assert.rejects(h.run(), (failure) => failure.needsSettings && /Allow motion access/.test(failure.message));
  assert.equal(h.phases.includes('passed'), false);
});
