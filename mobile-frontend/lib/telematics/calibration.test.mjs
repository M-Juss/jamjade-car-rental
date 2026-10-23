import assert from 'node:assert/strict';
import test from 'node:test';

import { CalibrationAccumulator, rotationAxes, stationaryWithinRange, forwardMotionFeedback, rcMovementFeedback } from './calibration.ts';
import { calibrationConsentSchema, calibrationEvidenceSchema } from '../../validation/telematics/calibration.ts';

const reference = { down: [0, -1, 0], forward: [0, 0, -1] };
const gravity = [0, -9.80665, 0];

test('stationary capture computes bounded summaries without retaining samples', () => {
  const capture = new CalibrationAccumulator(null);
  for (let i = 1; i <= 120; i++) capture.add([0, 0, 0], gravity, [0, 0, 0], i / 20, i * 50);
  const result = capture.summary(6000);
  assert.equal(result.sample_count, 120);
  assert.equal(result.sensor_duration_ms, 5950);
  assert.ok(Math.abs(result.max_gap_ms - 50) < 1e-8);
  assert.equal(result.linear_rms, 0);
  assert.ok(Math.abs(result.gravity_y + 9.80665) < 1e-10);
  assert.equal(result.samples, undefined);
});

test('upright mount maps forward acceleration and braking to opposite longitudinal signs', () => {
  const capture = new CalibrationAccumulator(reference);
  capture.add([0, 0, -0.8], gravity, [0, 0, 0], 1, 50);
  capture.add([0, 0, 0.7], gravity, [0, 0, 0], 1.05, 100);
  const result = capture.summary(100);
  assert.equal(result.longitudinal_max, 0.8);
  assert.equal(result.longitudinal_min, -0.7);
});

test('Expo Sensors 15 native rotation mappings produce the same physical XYZ axes', () => {
  assert.deepEqual(rotationAxes({ alpha: 1, beta: 2, gamma: 3 }, 'android'), [1, 2, 3]);
  assert.deepEqual(rotationAxes({ alpha: 3, beta: 2, gamma: 1 }, 'ios'), [1, 2, 3]);
});

test('left and right yaw integrate separately around the mounted vertical axis', () => {
  for (const direction of [1, -1]) {
    const capture = new CalibrationAccumulator(reference);
    for (let i = 0; i <= 100; i++) capture.add([0, 0, 0], gravity, [0, direction * 6, 0], 1 + i / 20, i * 50);
    const result = capture.summary(5000);
    assert.ok(Math.abs(result[direction === 1 ? 'yaw_left_degrees' : 'yaw_right_degrees'] - 30) < 1e-9);
    assert.equal(result[direction === 1 ? 'yaw_right_degrees' : 'yaw_left_degrees'], 0);
  }
});

test('gravity reference detects a tilted mount and gaps cannot fabricate turn evidence', () => {
  const capture = new CalibrationAccumulator(reference);
  capture.add([0, 0, 0], gravity, [0, 6, 0], 1, 50);
  capture.add([0, 0, 0], [0, -9.80665 * Math.cos(Math.PI / 6), -9.80665 * 0.5], [0, 6, 0], 3, 2050);
  const result = capture.summary(2100);
  assert.ok(Math.abs(result.max_tilt_degrees - 30) < 1e-8);
  assert.equal(result.yaw_left_degrees, 0);
  assert.equal(result.max_gap_ms, 2000);
});

test('duplicate timestamps and nonfinite readings do not inflate coverage', () => {
  const capture = new CalibrationAccumulator(reference);
  capture.add([0, 0, 0], gravity, [0, 0, 0], 1, 50);
  capture.add([0, 0, 0], gravity, [0, 0, 0], 1, 100);
  capture.add([NaN, 0, 0], gravity, [0, 0, 0], 1.05, 150);
  assert.equal(capture.summary(200).sample_count, 1);
  assert.equal(capture.summary(200).sensor_duration_ms, 0);
});

function evidence() {
  const capture = new CalibrationAccumulator(reference);
  capture.add([0, 0, 0], gravity, [0, 0, 0], 1, 50);
  return { ...capture.summary(100), protocol_version: 3, context: 'a'.repeat(64), consent: true, supervised: true, started_at: '2026-10-16T01:00:00.000Z', ended_at: '2026-10-16T01:00:06.000Z' };
}

test('capture schema mirrors consent, scalar bounds, dates and forbidden extra fields', () => {
  assert.equal(calibrationEvidenceSchema.safeParse(evidence()).success, true);
  for (const override of [
    { consent: false }, { supervised: false }, { samples: [] }, { sample_count: 2001 },
    { sample_count: 1.5 }, { sample_count: null }, { protocol_version: 1 }, { protocol_version: 2 }, { context: 'bad' },
    { gravity_x: Infinity }, { longitudinal_min: 1, longitudinal_max: 0 },
    { ended_at: '2026-10-16T00:59:00.000Z' },
    { horizontal_rms: null }, { linear_stddev: -1 }, { rotation_stddev: 2001 }, { noise_baseline: {} },
    { calibration_profile: { id: 'rc_demo' } },
  ]) assert.equal(calibrationEvidenceSchema.safeParse({ ...evidence(), ...override }).success, false);
  assert.equal(calibrationEvidenceSchema.safeParse({ ...evidence(), sample_count: '120', consent: 1 }).success, true);
  assert.equal(calibrationConsentSchema.safeParse({ consent: true, supervised: false }).success, false);
});

const mounts = [
  { name: 'flat face up', down: [0, 0, -1], forward: [0, 1, 0] },
  { name: 'flat face down', down: [0, 0, 1], forward: [-1, 0, 0] },
  { name: 'upright', down: [0, -1, 0], forward: [0, 0, -1] },
  { name: 'tilted', down: [0, -Math.SQRT1_2, -Math.SQRT1_2], forward: [0, Math.SQRT1_2, -Math.SQRT1_2] },
  { name: 'landscape', down: [-1, 0, 0], forward: [0, 1, 0] },
];
for (const mount of mounts) test(`${mount.name}: stationary, learned forward, braking and turns use the same mount`, () => {
  const g = mount.down.map((value) => value * 9.80665);
  const stationary = new CalibrationAccumulator(null);
  for (let i = 0; i < 120; i++) stationary.add([0, 0, 0], g, [0, 0, 0], 1 + i / 20, i * 50);
  assert.equal(stationary.summary(6000).sample_count, 120);
  const learning = new CalibrationAccumulator({ down: mount.down, forward: null });
  for (let i = 0; i < 240; i++) {
    // Start parked; accelerate, coast, then stop. Add vertical vibration.
    const longitudinal = i >= 20 && i < 60 ? 0.8 : i >= 120 && i < 160 ? -1 : 0;
    const acceleration = mount.forward.map((value, axis) => value * longitudinal + mount.down[axis] * 0.1);
    learning.add(acceleration, g, [0, 0, 0], 1 + i / 20, i * 50);
  }
  const learned = learning.summary(12000);
  const vector = [learned.forward_x, learned.forward_y, learned.forward_z];
  const length = Math.hypot(...vector);
  assert.ok(length > 0.79 && length < 0.81);
  assert.ok(learned.forward_duration_ms >= 500);
  assert.ok(learned.forward_coherence > 0.99);
  const forward = vector.map((value) => value / length);
  forward.forEach((value, axis) => assert.ok(Math.abs(value - mount.forward[axis]) < 1e-9));
  const braking = new CalibrationAccumulator({ down: mount.down, forward });
  for (let i = 0; i <= 100; i++) braking.add(forward.map((value) => value * -0.7), g, mount.down.map((value) => value * -6), 1 + i / 20, i * 50);
  const result = braking.summary(5000);
  assert.ok(Math.abs(result.longitudinal_min + 0.7) < 1e-9);
  assert.ok(Math.abs(result.yaw_left_degrees - 30) < 1e-9);
});

test('forward learning rejects isolated spikes, noise and gaps and exposes inconsistent direction', () => {
  for (const mode of ['noise', 'spike', 'gap', 'alternating']) {
    const learning = new CalibrationAccumulator({ down: [0, 0, -1], forward: null });
    for (let i = 0; i < 30; i++) {
      const acceleration = mode === 'noise' ? 0.1 : mode === 'spike' ? (i === 10 ? 2 : 0) : mode === 'alternating' ? (i % 2 ? -0.8 : 0.8) : 0.8;
      const seconds = mode === 'gap' ? i * 0.3 : i * 0.05;
      learning.add([acceleration, 0, 0], [0, 0, -9.80665], [0, 0, 0], 1 + seconds, seconds * 1000);
    }
    const result = learning.summary(9000);
    assert.ok(result.forward_duration_ms < 500 || result.forward_coherence < 0.9, mode);
  }
});

for (const pause of [false, true]) test(`Forward retries an inconsistent early window before learning clean motion (pause: ${pause})`, () => {
  const capture = new CalibrationAccumulator({ down: [0, 0, -1], forward: null });
  let sample = 0;
  const add = (acceleration) => { capture.add(acceleration, [0, 0, -9.80665], [0, 0, 0], 1 + sample / 20, sample * 50); sample++; };
  for (let i = 0; i < 22; i++) add([i % 2 ? -1 : 1, 0, 0]);
  if (pause) for (let i = 0; i < 4; i++) add([0, 0, 0]);
  for (let i = 0; i < 40; i++) add([0, 0.8, 0]);
  // A later stop must not overwrite the first genuinely consistent direction.
  for (let i = 0; i < 30; i++) add([0, -1, 0]);
  const result = capture.summary(sample * 50);
  assert.ok(Math.abs(result.forward_x) < 1e-9);
  assert.ok(Math.abs(result.forward_y - 0.8) < 1e-9);
  assert.ok(result.forward_coherence >= 0.99);
  assert.ok(result.forward_duration_ms >= 500);
  assert.equal(result.sample_count, sample); // Rejected candidates remain in whole-capture quality evidence.
});

test('Forward retries candidates that fail the server mean, coherence or sample minimum', () => {
  for (const mode of ['mean', 'coherence', 'samples']) {
    const limits = { acceleration: 0.5, durationMs: 500, coherence: mode === 'coherence' ? 0.99 : 0.9, samples: mode === 'samples' ? 10 : 5 };
    const capture = new CalibrationAccumulator({ down: [0, 0, -1], forward: null }, limits);
    let elapsed = 0;
    const add = (a, interval = 50) => { elapsed += interval; capture.add(a, [0, 0, -9.80665], [0, 0, 0], 1 + elapsed / 1000, elapsed); };
    // These are eligible horizontal samples but their window fails one server criterion.
    for (let i = 0; i < (mode === 'samples' ? 7 : 13); i++) add(mode === 'mean' ? [0.48, i % 2 ? 0.15 : -0.15, 0] : [0.8, i % 2 ? 0.2 : -0.2, 0], mode === 'samples' ? 100 : 50);
    add([0, 0, 0]);
    assert.equal(capture.summary(elapsed).forward_duration_ms, 0, mode);
    for (let i = 0; i < 30; i++) add([0, 0.8, 0]);
    const result = capture.summary(elapsed);
    assert.ok(Math.abs(result.forward_x) < 1e-9, mode);
    assert.ok(Math.abs(result.forward_y - 0.8) < 1e-9, mode);
    assert.ok(result.forward_sample_count >= limits.samples, mode);
  }
});

test('retrying Forward candidates preserves full-capture gaps, rotation and mount evidence', () => {
  const capture = new CalibrationAccumulator({ down: [0, 0, -1], forward: null });
  capture.add([1, 0, 0], [0, 0, -9.80665], [12, 0, 0], 1, 0);
  capture.add([-1, 0, 0], [4.903325, 0, -9.80665 * Math.cos(Math.PI / 6)], [0, 0, 0], 1.65, 650);
  for (let i = 0; i < 40; i++) capture.add([0, 0.8, 0], [0, 0, -9.80665], [0, 0, 0], 1.7 + i / 20, 700 + i * 50);
  const result = capture.summary(2650);
  assert.ok(Math.abs(result.forward_y - 0.8) < 1e-9);
  assert.ok(result.max_gap_ms >= 650);
  assert.equal(result.rotation_peak, 12);
  assert.ok(result.max_tilt_degrees > 29.9);
  assert.equal(result.sample_count, 42);
});

test('stationary live guidance follows every server-provided motion limit', () => {
  const limits = { linearRms: 0.35, rotationPeak: 6, tiltDegrees: 10, yawDegrees: 5, maxGapMs: 500 };
  const reading = { acceleration: 0.35, rotation: 6, tilt: 10, yaw: 5, maxGapMs: 500, elapsedMs: 1000, durationMs: 6000 };
  assert.equal(stationaryWithinRange(reading, limits), true);
  for (const field of ['acceleration', 'rotation', 'tilt', 'yaw', 'maxGapMs']) assert.equal(stationaryWithinRange({ ...reading, [field]: reading[field] + 0.01 }, limits), false, field);
  assert.equal(stationaryWithinRange(reading, { ...limits, linearRms: 0.2 }), false);
});

const forwardLimits = { acceleration: 0.5, durationMs: 500, coherence: 0.9, samples: 5 };
const mountLimits = { linearRms: 0.35, rotationPeak: 6, tiltDegrees: 10, yawDegrees: 5, maxGapMs: 500 };
const forwardReading = {
  elapsedMs: 1000, durationMs: 12000, acceleration: 0.2, rotation: 1, tilt: 0, yaw: 0, maxGapMs: 50,
  forward: { acceleration: 0.8, meanAcceleration: 0.8, durationMs: 600, coherence: 0.99, samples: 12 },
};

test('Forward feedback separates waiting, building and captured movement from recording time', () => {
  assert.equal(forwardMotionFeedback(undefined, forwardLimits, mountLimits).state, 'waiting');
  assert.equal(forwardMotionFeedback({ ...forwardReading, forward: undefined }, forwardLimits, mountLimits).state, 'waiting');
  assert.deepEqual(forwardMotionFeedback({ ...forwardReading, forward: { ...forwardReading.forward, durationMs: 200 } }, forwardLimits, mountLimits), { state: 'building', progress: 0.4 });
  assert.deepEqual(forwardMotionFeedback(forwardReading, forwardLimits, mountLimits), { state: 'captured', progress: 1 });
  assert.deepEqual(forwardMotionFeedback({ ...forwardReading, forward: { acceleration: 0.1, meanAcceleration: 3.02, durationMs: 0, coherence: 1, samples: 1 } },
    { acceleration: 3, durationMs: 0, coherence: 0.9, samples: 1 }, mountLimits), { state: 'captured', progress: 1 });
  assert.deepEqual(forwardMotionFeedback({ ...forwardReading, rotation: 55.51 }, forwardLimits, mountLimits, false,
    { rotationPeak: 60, yawDegrees: 180, forwardAccelerationOnly: false }), { state: 'captured', progress: 1 });
  assert.deepEqual(forwardMotionFeedback({ ...forwardReading, rotation: 500, yaw: 500 }, forwardLimits, mountLimits, false,
    { rotationPeak: 120, yawDegrees: 45, forwardAccelerationOnly: true }), { state: 'captured', progress: 1 });
  assert.equal(forwardMotionFeedback({ ...forwardReading, forward: { ...forwardReading.forward, acceleration: 0 } }, forwardLimits, mountLimits).state, 'captured');
  assert.notEqual(forwardMotionFeedback({ ...forwardReading, forward: { ...forwardReading.forward, samples: 4 } }, forwardLimits, mountLimits).progress, 1);
});

test('Forward feedback follows server thresholds and suppresses captured status after quality problems', () => {
  for (const [override, state] of [
    [{ maxGapMs: 501 }, 'interrupted'], [{ tilt: 11 }, 'mount_moved'], [{ yaw: 6 }, 'turning'], [{ rotation: 7 }, 'turning'],
    [{ forward: { ...forwardReading.forward, coherence: 0.89 } }, 'inconsistent'],
    [{ forward: { ...forwardReading.forward, meanAcceleration: 0.49 } }, 'inconsistent'],
  ]) {
    const feedback = forwardMotionFeedback({ ...forwardReading, ...override }, forwardLimits, mountLimits);
    assert.equal(feedback.state, state);
    assert.equal(feedback.progress, 0);
  }
  assert.equal(forwardMotionFeedback(forwardReading, forwardLimits, mountLimits, true).state, 'interrupted');
  assert.equal(forwardMotionFeedback(forwardReading, { ...forwardLimits, acceleration: 0.9 }, mountLimits).state, 'inconsistent');
  assert.equal(forwardMotionFeedback(forwardReading, { ...forwardLimits, durationMs: 750 }, mountLimits).state, 'building');
});

test('noise summaries distinguish three-axis bias, variation and horizontal energy', () => {
  const capture = new CalibrationAccumulator(null);
  for (let i = 0; i < 120; i++) capture.add([i % 2 ? 0.2 : -0.2, 0.1, 0], gravity, [i % 2 ? 2 : -2, 0, 0], 1 + i / 20, i * 50);
  const summary = capture.summary(6000);
  assert.ok(Math.abs(summary.linear_mean_y - 0.1) < 0.000001);
  assert.ok(Math.abs(summary.linear_stddev - 0.2) < 0.000001);
  assert.ok(Math.abs(summary.horizontal_rms - 0.2) < 0.000001);
  assert.ok(Math.abs(summary.linear_rms ** 2 - 0.05) < 0.000001);
  assert.equal(summary.rotation_mean_x, 0);
  assert.equal(summary.rotation_rms, 2);
  assert.equal(summary.rotation_stddev, 2);
  assert.equal(summary.samples, undefined);
});

const rcLimits = { tiltDegrees: 60, rotationPeak: 120, yawDegrees: 45, brakingAcceleration: 0.5, turnDegrees: 10, oppositeTurnDegrees: 20, turnDominance: 1.5 };
const rcForward = { acceleration: 0.5, durationMs: 250, coherence: 0.7, samples: 5 };
const rcReading = {
  elapsedMs: 2800, durationMs: 3000, acceleration: 0.8, rotation: 70, tilt: 35, yaw: 15, maxGapMs: 50,
  forward: { acceleration: 0, meanAcceleration: 0.8, durationMs: 300, coherence: 0.8, samples: 6 },
  movement: { braking: 0, leftDegrees: 0, rightDegrees: 0 },
};

test('RC Forward recognizes a brief coherent movement despite allowed body vibration and a later stop', () => {
  assert.equal(rcMovementFeedback('forward_calibration', rcReading, rcLimits, rcForward, 500), 'captured');
  assert.equal(rcMovementFeedback('forward_calibration', { ...rcReading, forward: { ...rcReading.forward, meanAcceleration: 0.1 } }, rcLimits, rcForward, 500), 'waiting');
  assert.equal(rcMovementFeedback('forward_calibration', { ...rcReading, forward: { ...rcReading.forward, coherence: 0.2 } }, rcLimits, rcForward, 500), 'waiting');
});

test('RC braking and turns require their own movement and the requested turn must dominate', () => {
  for (const step of ['braking_calibration', 'left_turn_calibration', 'right_turn_calibration']) {
    assert.equal(rcMovementFeedback(step, rcReading, rcLimits, rcForward, 500), 'waiting');
  }
  assert.equal(rcMovementFeedback('braking_calibration', { ...rcReading, movement: { ...rcReading.movement, braking: 0.6 } }, rcLimits, rcForward, 500), 'captured');
  for (const step of ['left_turn_calibration', 'right_turn_calibration']) {
    const left = step === 'left_turn_calibration';
    const movement = { braking: 0, leftDegrees: left ? 15 : 2, rightDegrees: left ? 2 : 15 };
    assert.equal(rcMovementFeedback(step, { ...rcReading, movement }, rcLimits, rcForward, 500), 'captured');
    assert.equal(rcMovementFeedback(step, { ...rcReading, movement: { ...movement, leftDegrees: movement.rightDegrees, rightDegrees: movement.leftDegrees } }, rcLimits, rcForward, 500), 'waiting');
    assert.equal(rcMovementFeedback(step, { ...rcReading, movement: { braking: 0, leftDegrees: 15, rightDegrees: 14 } }, rcLimits, rcForward, 500), 'waiting');
  }
});

test('RC feedback retains stream, position and straight-movement checks', () => {
  assert.equal(rcMovementFeedback('forward_calibration', undefined, rcLimits, rcForward, 500), 'waiting');
  assert.equal(rcMovementFeedback('forward_calibration', rcReading, rcLimits, rcForward, 500, true), 'interrupted');
  assert.equal(rcMovementFeedback('forward_calibration', { ...rcReading, maxGapMs: 501 }, rcLimits, rcForward, 500), 'interrupted');
  assert.equal(rcMovementFeedback('forward_calibration', { ...rcReading, tilt: 61 }, rcLimits, rcForward, 500), 'position_changed');
  assert.equal(rcMovementFeedback('forward_calibration', { ...rcReading, yaw: 46 }, rcLimits, rcForward, 500), 'keep_straight');
});
