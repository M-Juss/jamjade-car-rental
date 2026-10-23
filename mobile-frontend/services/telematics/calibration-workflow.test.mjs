import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

import { isCalibrationStep } from '../../lib/telematics/calibration.ts';
import { calibrationConsentSchema, calibrationEvidenceSchema } from '../../validation/telematics/calibration.ts';

function workflowHarness({ profileId = 'standard', profileFingerprint = 'a'.repeat(64), protocolVersion = 3, noiseBaseline = { horizontalRms: 0.1 }, locked = false, nextStep = 'stationary_calibration', reference = { down: [0, -1, 0], forward: [0, 0, -1] }, capture, offlineAfterCapture = false, serverStatus = 'passed' } = {}) {
  const source = readFileSync(new URL('./calibration-workflow.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let captures = 0;
  let submissions = 0;
  let reads = 0;
  const current = {
    eligibility: { canWorkSetup: !locked },
    calibration: { profile: { id: profileId, fingerprint: profileFingerprint, revision: profileId === 'rc_demo' ? 4 : 3 }, noiseBaseline, completionLimits: { minimumDurationMs: 1000, minimumCoverage: 0.85, minimumSamplesPerSecond: 8 }, movementLimits: { tiltDegrees: 60, rotationPeak: profileId === 'rc_demo' ? 120 : 60, yawDegrees: profileId === 'rc_demo' ? 45 : 180, forwardAccelerationOnly: profileId === 'rc_demo', brakingAcceleration: 0.5, turnDegrees: 10, oppositeTurnDegrees: 20, turnDominance: 1.5 }, forwardLimits: { acceleration: profileId === 'rc_demo' ? 3 : 0.6, durationMs: 600, coherence: 0.95, samples: 6 }, protocolVersion, nextStep, context: 'a'.repeat(64), captureSeconds: { stationary_calibration: 6, forward_calibration: profileId === 'rc_demo' ? 3 : 12, braking_calibration: 3, left_turn_calibration: 3, right_turn_calibration: 3 }, stationaryLimits: { linearRms: 0.35, rotationPeak: 6, tiltDegrees: 10, yawDegrees: 5, maxGapMs: 500 }, reference },
  };
  const summary = {
    started_at: '2026-10-16T06:00:00.000Z', ended_at: '2026-10-16T06:00:06.000Z',
    forward_x: 0, forward_y: 0, forward_z: 0, forward_duration_ms: 0, forward_sample_count: 0, forward_coherence: 0,
    linear_mean_x: 0, linear_mean_y: 0, linear_mean_z: 0, linear_stddev: 0.1, horizontal_rms: 0.1,
    rotation_mean_x: 0, rotation_mean_y: 0, rotation_mean_z: 0, rotation_rms: 1, rotation_stddev: 1,
    sample_count: 120, sensor_duration_ms: 5900, max_gap_ms: 100, linear_rms: 0.1,
    rotation_peak: 1, longitudinal_min: 0, longitudinal_max: 0, yaw_left_degrees: 0,
    yaw_right_degrees: 0, max_tilt_degrees: 0, gravity_x: 0, gravity_y: -9.8, gravity_z: 0,
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Error, Promise,
    require(name) {
      if (name.endsWith('/calibration') && name.includes('lib/')) return { isCalibrationStep };
      if (name.includes('validation/')) return { calibrationConsentSchema, calibrationEvidenceSchema };
      if (name === './network-readiness') return { getNetworkReadiness: async () => !(offlineAfterCapture && captures > 0) };
      if (name === './calibration-capture') return { captureCalibration: async (...args) => { captures++; if (capture) await capture(...args); else { args[3]?.onReady?.(); args[3]?.onReading?.({ elapsedMs: 1000, durationMs: 6000, acceleration: 0.1, rotation: 1, tilt: 0, yaw: 0, maxGapMs: 100 }); } return summary; } };
      if (name === '@/services/api') return {
        getBookingTelematicsSetup: async () => { reads++; return current; },
        submitTelematicsSetupAttempt: async () => { submissions++; return { ...current, steps: [{ type: nextStep, status: serverStatus }], setup: { status: 'in_progress' } }; },
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { run: (...args) => exports.runCalibrationCheck(...args.slice(0, 6), 'a'.repeat(64), ...args.slice(6)), get captures() { return captures; }, get submissions() { return submissions; }, get reads() { return reads; } };
}

const consent = { consent: true, supervised: true };
const noOp = () => {};

test('locked or changed server state never starts an unexpected native capture', async () => {
  for (const options of [{ locked: true }, { nextStep: 'forward_calibration' }]) {
    const harness = workflowHarness(options);
    await assert.rejects(harness.run('DEMO', consent, new AbortController().signal, noOp, noOp, 'stationary_calibration'));
    assert.equal(harness.captures, 0);
    assert.equal(harness.submissions, 0);
  }
});

test('missing recording consent or supervision never reads server state or starts capture', async () => {
  for (const values of [{ ...consent, consent: false }, { ...consent, supervised: false }, {}]) {
    const harness = workflowHarness();
    await assert.rejects(harness.run('DEMO', values, new AbortController().signal, noOp, noOp, 'stationary_calibration'));
    assert.equal(harness.reads, 0);
    assert.equal(harness.captures, 0);
    assert.equal(harness.submissions, 0);
  }
});

test('navigation cancellation after native capture never submits evidence', async () => {
  const controller = new AbortController();
  const harness = workflowHarness({ capture: async () => controller.abort() });
  await harness.run('DEMO', consent, controller.signal, noOp, noOp, 'stationary_calibration');
  assert.equal(harness.captures, 1);
  assert.equal(harness.submissions, 0);
});

test('an offline completion cannot fabricate a saved calibration result', async () => {
  const harness = workflowHarness({ offlineAfterCapture: true });
  await assert.rejects(harness.run('DEMO', consent, new AbortController().signal, noOp, noOp, 'stationary_calibration'), /offline/);
  assert.equal(harness.submissions, 0);
});

test('one explicitly consented capture submits once and returns the server result', async () => {
  const harness = workflowHarness();
  const result = await harness.run('DEMO', consent, new AbortController().signal, noOp, noOp, 'stationary_calibration');
  assert.equal(harness.captures, 1);
  assert.equal(harness.submissions, 1);
  assert.equal(result.failed, false);
});

test('forward capture uses the stationary vertical with no assumed forward axis', async () => {
  let capturedReference;
  const reference = { down: [0, 0, -1], forward: null };
  const harness = workflowHarness({ nextStep: 'forward_calibration', reference, capture: async (_, received) => { capturedReference = received; } });
  await harness.run('DEMO', consent, new AbortController().signal, noOp, noOp, 'forward_calibration');
  assert.deepEqual(capturedReference, reference);
});

test('braking never starts without a learned forward direction', async () => {
  const harness = workflowHarness({ nextStep: 'braking_calibration', reference: { down: [0, 0, -1], forward: null } });
  await assert.rejects(harness.run('DEMO', consent, new AbortController().signal, noOp, noOp, 'braking_calibration'), /forward calibration/);
  assert.equal(harness.captures, 0);
});

test('live feedback waits for fresh capture and only the server can confirm success', async () => {
  for (const serverStatus of ['passed', 'failed']) {
    const harness = workflowHarness({ serverStatus });
    const phases = [], recording = [];
    const result = await harness.run('DEMO', consent, new AbortController().signal, noOp, (value) => recording.push(value), 'stationary_calibration', false, (state) => phases.push(state.phase));
    assert.deepEqual(phases, ['preparing', 'recording', 'evaluating', serverStatus]);
    assert.deepEqual(recording, [true, false]);
    assert.equal(result.failed, serverStatus === 'failed');
  }
});

test('Forward capture uses all server-provided window limits', async () => {
  for (const nextStep of ['stationary_calibration', 'forward_calibration']) {
    let options;
    const harness = workflowHarness({ nextStep, capture: async (_, __, ___, received) => { options = received; } });
    await harness.run('DEMO', consent, new AbortController().signal, noOp, noOp, nextStep);
    assert.deepEqual(options.forwardLimits, nextStep === 'forward_calibration' ? { acceleration: 0.6, durationMs: 600, coherence: 0.95, samples: 6 } : undefined);
  }
});

test('only movement exercises receive the server completion policy', async () => {
  for (const nextStep of ['stationary_calibration', 'forward_calibration', 'braking_calibration', 'left_turn_calibration', 'right_turn_calibration']) {
    let options;
    const harness = workflowHarness({ nextStep, capture: async (_, __, ___, received) => { options = received; } });
    await harness.run('DEMO', consent, new AbortController().signal, noOp, noOp, nextStep);
    if (nextStep === 'stationary_calibration') assert.equal(options.completion, undefined);
    else {
      assert.equal(options.completion.step, nextStep);
      assert.equal(options.completion.quality.minimumDurationMs, 1000);
      assert.equal(options.completion.quality.minimumCoverage, 0.85);
      assert.equal(options.completion.quality.minimumSamplesPerSecond, 8);
      assert.equal(options.completion.maxGapMs, 500);
      assert.equal(options.completion.movement.turnDominance, 1.5);
    }
  }
});


test('legacy capture protocol or missing accepted noise baseline cannot start Forward sensors', async () => {
  for (const options of [{ protocolVersion: 2 }, { noiseBaseline: null }]) {
    const harness = workflowHarness({ ...options, nextStep: 'forward_calibration', reference: { down: [0, -1, 0], forward: null } });
    await assert.rejects(harness.run('DEMO', consent, new AbortController().signal, noOp, noOp, 'forward_calibration'));
    assert.equal(harness.captures, 0);
    assert.equal(harness.submissions, 0);
  }
});

test('a changed profile requires reopening calibration before sensors start', async () => {
  const harness = workflowHarness({ profileId: 'rc_demo', profileFingerprint: 'b'.repeat(64) });
  await assert.rejects(harness.run('DEMO', consent, new AbortController().signal, noOp, noOp, 'stationary_calibration'), /settings changed/);
  assert.equal(harness.captures, 0);
  assert.equal(harness.submissions, 0);
});

test('the RC profile uses real captures and only a server-confirmed pass succeeds', async () => {
  for (const serverStatus of ['passed', 'failed']) {
    const harness = workflowHarness({ profileId: 'rc_demo', serverStatus });
    const result = await harness.run('DEMO', consent, new AbortController().signal, noOp, noOp, 'stationary_calibration');
    assert.equal(harness.captures, 1);
    assert.equal(harness.submissions, 1);
    assert.equal(result.failed, serverStatus === 'failed');
  }
});

for (const nextStep of ['forward_calibration', 'braking_calibration', 'left_turn_calibration', 'right_turn_calibration']) {
  test(`RC ${nextStep}: three-second capture waits for the authoritative server outcome`, async () => {
    for (const serverStatus of ['passed', 'failed']) {
      let seconds;
      const harness = workflowHarness({ profileId: 'rc_demo', nextStep, serverStatus,
        capture: async (duration) => { seconds = duration; } });
      const phases = [];
      const result = await harness.run('DEMO', consent, new AbortController().signal, noOp, noOp, nextStep, false, (state) => phases.push(state.phase));
      assert.equal(seconds, 3);
      assert.equal(harness.submissions, 1);
      assert.equal(phases.at(-1), serverStatus);
      assert.equal(result.failed, serverStatus === 'failed');
    }
  });
}
