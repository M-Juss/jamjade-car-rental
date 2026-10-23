import assert from 'node:assert/strict';
import test from 'node:test';
import { stationaryResumeFailure, stationaryResumeSettingsValid } from './stationary-resume.ts';

const settings = {
  captureSeconds: { stationary_calibration: 6 }, profile: { id: 'standard', revision: 1, fingerprint: 'test' },
  stationaryLimits: { linearRms: 0.35, rotationPeak: 6, yawDegrees: 5, tiltDegrees: 10, maxGapMs: 500 },
  completionLimits: { minimumDurationMs: 1000, minimumCoverage: 0.85, minimumSamplesPerSecond: 8 },
};
const summary = {
  started_at: '2026-10-19T01:00:00.000Z', ended_at: '2026-10-19T01:00:06.000Z',
  sample_count: 120, sensor_duration_ms: 5950, max_gap_ms: 50, linear_rms: 0.05, rotation_peak: 0.1,
  max_tilt_degrees: 1, yaw_left_degrees: 0.1, yaw_right_degrees: 0.1, gravity_x: 0, gravity_y: -9.81, gravity_z: 0,
};

test('a full stable capture passes in different mounted orientations without changing the saved reference', () => {
  for (const gravity of [[0, -9.81, 0], [0, 0, 9.81], [9.81, 0, 0]]) {
    assert.equal(stationaryResumeFailure({ ...summary, gravity_x: gravity[0], gravity_y: gravity[1], gravity_z: gravity[2] }, settings), null);
  }
});

test('movement, rotation and tilt fail the check even when the final reading would be steady', () => {
  for (const changed of [{ linear_rms: 0.36 }, { rotation_peak: 6.1 }, { max_tilt_degrees: 10.1 }, { yaw_left_degrees: 3, yaw_right_degrees: 3 }]) {
    assert.match(stationaryResumeFailure({ ...summary, ...changed }, settings), /not steady/);
  }
});

test('partial, sparse, stale, implausible or nonfinite motion never passes', () => {
  for (const changed of [
    { sample_count: 10 }, { sample_count: 2000 }, { sample_count: 55.5 }, { sensor_duration_ms: 1000 },
    { sensor_duration_ms: 7000 }, { max_gap_ms: 501 }, { linear_rms: NaN }, { rotation_peak: -1 },
    { ended_at: 'invalid' }, { ended_at: '2026-10-19T01:00:02.000Z' }, { ended_at: '2026-10-19T01:00:10.000Z' },
    { gravity_y: 0 }, { gravity_y: 20 },
  ]) assert.notEqual(stationaryResumeFailure({ ...summary, ...changed }, settings), null);
});

test('invalid policies fail closed', () => {
  for (const changed of [
    { captureSeconds: { stationary_calibration: NaN } }, { captureSeconds: { stationary_calibration: 31 } },
    { completionLimits: { ...settings.completionLimits, minimumCoverage: 0 } },
    { stationaryLimits: { ...settings.stationaryLimits, rotationPeak: Infinity } },
  ]) {
    const policy = { ...settings, ...changed };
    assert.equal(stationaryResumeSettingsValid(policy), false);
    assert.notEqual(stationaryResumeFailure(summary, policy), null);
  }
});
