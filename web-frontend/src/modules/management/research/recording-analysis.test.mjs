import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// Pure timing/math regressions; no frontend test framework or browser mocks.
const source = await readFile(new URL("./recording-analysis.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { signalPoints, annotationTime, intervalStats, nearestPoint } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

function sample(elapsed, sensorMs, values = {}) {
  return {
    elapsed_ms: elapsed, acceleration_timestamp_s: 100 + sensorMs / 1000,
    gravity_timestamp_s: 100 + sensorMs / 1000, rotation_timestamp_s: 100 + sensorMs / 1000,
    linear_x: 1, linear_y: 2, linear_z: 2, including_gravity_x: 1, including_gravity_y: 2, including_gravity_z: 12,
    rotation_x: 0, rotation_y: 0, rotation_z: 2, orientation: 0, ...values,
  };
}

test("plots sensor timing rather than irregular callback arrival timing", () => {
  const points = signalPoints([sample(0, 0), sample(90, 20), sample(110, 40)], "linear");
  assert.ok(Math.abs(points[1].time - 20) < 1e-6);
  assert.ok(Math.abs(points[2].time - 40) < 1e-6);
});

test("retains a short high peak and uses only the selected interval for statistics", () => {
  const points = signalPoints([sample(0, 0), sample(20, 20, { linear_x: 24 }), sample(40, 40)], "linear");
  const whole = intervalStats(points, 0, 100);
  assert.equal(whole.peak, Math.hypot(24, 2, 2));
  assert.equal(intervalStats(points, 30, 100).peak, 3);
});

test("breaks long gaps without replacing missing measurements with zero", () => {
  const points = signalPoints([sample(0, 0), sample(100, 100), sample(800, 800)], "linear");
  assert.equal(points.length, 4);
  assert.equal(points[2].x, null);
  assert.equal(intervalStats(points, 0, 1000).count, 3);
  assert.equal(nearestPoint(points, 450), null);
  assert.equal(intervalStats(points, 300, 600), null);
});

test("uses each channel timestamp on a common clock", () => {
  const samples = [sample(0, 0, { rotation_timestamp_s: 100.05 })];
  assert.ok(Math.abs(signalPoints(samples, "rotation")[0].time - 50) < 1e-6);
  assert.equal(signalPoints(samples, "linear")[0].time, 0);
});

test("does not count a reused gyro event as several separate plotted readings", () => {
  const samples = [sample(0, 0), sample(20, 20, { rotation_timestamp_s: 100, rotation_z: 5 }), sample(40, 40)];
  const points = signalPoints(samples, "rotation");
  assert.equal(points.length, 2);
  assert.equal(points[0].z, 5);
  assert.equal(samples.length, 3);
});

test("maps recorder annotation bounds to the saved sensor clock without changing originals", () => {
  const samples = [sample(0, 0), sample(100, 20), sample(200, 40)];
  assert.ok(Math.abs(annotationTime(samples, 150) - 30) < 1e-6);
  assert.equal(samples[1].elapsed_ms, 100);
});

test("handles empty and single-point intervals without invented measurements", () => {
  assert.equal(intervalStats([], 0, 100), null);
  assert.equal(nearestPoint([], 0), null);
  assert.equal(annotationTime([], 50), 50);
  const points = signalPoints([sample(50, 0)], "linear");
  assert.equal(intervalStats(points, 50, 50).rms, 3);
});
