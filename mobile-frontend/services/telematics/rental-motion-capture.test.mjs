import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as calibration from '../../lib/telematics/calibration.ts';

const source = readFileSync(new URL('./rental-motion-capture.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const settings = {
  captureSeconds: { stationary_calibration: 6, forward_calibration: 3 },
  stationaryLimits: { linearRms: 0.35, rotationPeak: 6, tiltDegrees: 10, yawDegrees: 10, maxGapMs: 500 },
  forwardLimits: { acceleration: 0.5, durationMs: 120, samples: 7, coherence: 0.9 },
  completionLimits: { minimumDurationMs: 1000, minimumCoverage: 0.85, minimumSamplesPerSecond: 8 },
  movementLimits: { tiltDegrees: 10, rotationPeak: 60, yawDegrees: 45, forwardAccelerationOnly: false },
  reference: { down: [0, 0, -1], forward: null },
  parkedAcceleration: [0, 0.18, 9.8],
};

function harness(step, launch, abortOnReady = false, gyro = () => 0.02, abortAt = Infinity, omitRows = () => false) {
  const controller = new AbortController();
  const exports = {};
  const readings = [];
  let clock = 0;
  let listening = true;
  let canceled = false;
  const recorder = {
    beginRentalMotion: async (seconds) => {
      assert.equal(seconds, step === 'forward_calibration' ? 0 : 30);
      return 'test-capture';
    },
    readRentalMotion: async () => {
      const rows = [];
      for (let i = 0; i < 5; i++) {
        clock += 20;
        if (!omitRows(clock)) rows.push([clock, 0, 0.18 + launch(clock), 9.8, 0, 0, gyro(clock), 0, 0, 9.8]);
      }
      if (clock >= abortAt) controller.abort();
      return JSON.stringify({ rows, clockMs: clock, wallMs: Date.UTC(2026, 10, 9) });
    },
    cancelRentalMotion: async () => { canceled = true; },
  };
  vm.runInNewContext(compiled, {
    exports, setTimeout: (callback) => queueMicrotask(callback),
    require(name) {
      if (name === 'react-native') return { AppState: { currentState: 'active', addEventListener: () => ({ remove: () => { listening = false; } }) } };
      if (name === '@/modules/rc-recorder') return { default: recorder };
      if (name === '@/lib/telematics/calibration') return calibration;
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  const result = exports.captureRentalMotion(step, settings, controller.signal,
    () => { if (abortOnReady) controller.abort(); }, (reading) => readings.push(reading));
  return { result, readings, cleanedUp: () => canceled && !listening };
}

test('native stationary summary keeps down, acceleration and gyro units consistent', async () => {
  const run = harness('stationary_calibration', () => 0);
  const evidence = await run.result;
  assert.equal(evidence.sample_count, 301);
  assert.ok(Math.abs(evidence.gravity_z + 9.8) < 1e-9);
  assert.ok(Math.abs(evidence.linear_mean_y - 0.18) < 1e-9);
  assert.ok(Math.abs(evidence.rotation_peak - 0.02 * 180 / Math.PI) < 1e-9);
  assert.ok(run.cleanedUp());
});

test('a coherent gentle launch resolves forward even when the stop is stronger', async () => {
  const run = harness('forward_calibration', (ms) => ms >= 600 && ms < 800 ? 0.7 : ms >= 900 && ms < 1120 ? -1.4 : 0);
  const evidence = await run.result;
  assert.ok(Math.abs(evidence.forward_y - 0.7) < 1e-9);
  assert.ok(evidence.forward_sample_count >= 7);
  assert.ok(evidence.sensor_duration_ms < 3000);
  assert.ok(run.cleanedUp());
});

test('forward check reports movement while waiting for the phone to settle', async () => {
  const run = harness('forward_calibration', () => 0, false, () => 0.8, 1000);
  await assert.rejects(run.result, /paused/);
  assert.ok(run.readings.some(reading => reading.forwardStatus === 'retry'));
  assert.ok(run.cleanedUp());
});

test('forward check fails and cleans up when sensor readings stop', async () => {
  const run = harness('forward_calibration', () => 0, false, undefined, Infinity, ms => ms > 500);
  await assert.rejects(run.result, /Motion readings stopped/);
  assert.ok(run.cleanedUp());
});

test('an isolated launch spike cannot be replaced by the following stop', async () => {
  const run = harness('forward_calibration', (ms) => ms === 600 ? 2 : ms >= 900 && ms < 1120 ? -1.4 : 0, false, undefined, 6000);
  await assert.rejects(run.result, /paused/);
  assert.ok(run.readings.some(reading => reading.forwardStatus === 'retry'));
  assert.ok(run.cleanedUp());
});

test('a late launch uses a fresh bounded summary after waiting longer than the former deadline', async () => {
  const run = harness('forward_calibration', (ms) => ms >= 45000 && ms < 45200 ? 0.7 : 0, false, undefined, 50000);
  const evidence = await run.result;
  assert.equal(evidence.started_at, new Date(Date.UTC(2026, 10, 9) + 45000).toISOString());
  assert.ok(evidence.sensor_duration_ms < 3000);
  assert.ok(run.cleanedUp());
});

test('a failed movement can be followed by a fresh launch after stopping', async () => {
  const run = harness('forward_calibration', (ms) => ms === 600 ? 2 : ms >= 5200 && ms < 5400 ? 0.7 : 0, false, undefined, 8000);
  const evidence = await run.result;
  assert.equal(evidence.started_at, new Date(Date.UTC(2026, 10, 9) + 5200).toISOString());
  assert.ok(Math.abs(evidence.forward_y - 0.7) < 1e-9);
  assert.ok(run.cleanedUp());
});

test('canceling from the recording callback discards the capture and stops the native listener', async () => {
  const run = harness('stationary_calibration', () => 0, true);
  await assert.rejects(run.result, /paused/);
  assert.ok(run.cleanedUp());
});

test('a gyro spike resets the stationary timer and only the next uninterrupted window is saved', async () => {
  const run = harness('stationary_calibration', () => 0, false, ms => ms === 2000 ? 0.8 : 0.02);
  const evidence = await run.result;
  assert.ok(run.readings.some(reading => reading.elapsedMs > 1000));
  const reset = run.readings.findIndex(reading => reading.elapsedMs === 0 && reading.rotation > 6);
  assert.ok(reset > 0);
  assert.ok(run.readings.slice(reset + 1).some(reading => reading.rotation < 6));
  assert.equal(evidence.started_at, new Date(Date.UTC(2026, 10, 9) + 2320).toISOString());
  assert.equal(evidence.sample_count, 301);
  assert.ok(Math.abs(evidence.rotation_peak - 0.02 * 180 / Math.PI) < 1e-9);
  assert.ok(run.cleanedUp());
});

test('persistent movement reaches the capture deadline and releases the recorder', async () => {
  const run = harness('stationary_calibration', () => 0, false, () => 0.8);
  await assert.rejects(run.result, /did not stay steady/);
  assert.ok(run.readings.length > 0);
  assert.ok(run.readings.every(reading => reading.elapsedMs === 0));
  assert.ok(run.cleanedUp());
});
