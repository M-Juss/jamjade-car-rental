import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as zod from "zod";

const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("./annotations.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, require: name => { assert.equal(name, "zod"); return zod; } });
const schema = exports.annotationRevisionSchema;
const interval = { start_ms: 0, end_ms: 1000, movement: "stationary", direction: "not_applicable", severity: "not_applicable",
  certainty: "reviewed", source: "operator_report", notes: "" };
const trial = { ...interval, start_ms: 1000, end_ms: 2000, movement: "acceleration", direction: "forward", severity: "normal", certainty: "uncertain", source: "signal_review" };

test("annotations accept empty revisions, adjacent half-open phases and uncertain signal review", () => {
  assert.equal(schema.safeParse({ base_revision: 0, intervals: [] }).success, true);
  assert.equal(schema.safeParse({ base_revision: 3, intervals: [interval, trial] }).success, true);
  assert.equal(schema.safeParse({ base_revision: 0, intervals: [{ ...interval, notes: null }] }).success, true);
});
test("annotations reject overlap, zero-length, reversed, nonfinite and out-of-order ranges", () => {
  for (const item of [{ ...trial, start_ms: 999 }, { ...trial, start_ms: 2000 }, { ...trial, start_ms: 2100 },
    { ...trial, end_ms: Infinity }, { ...trial, start_ms: NaN }, { ...trial, start_ms: -1 }]) {
    assert.equal(schema.safeParse({ base_revision: 0, intervals: [interval, item] }).success, false);
  }
  assert.equal(schema.safeParse({ base_revision: 0, intervals: [trial, interval] }).success, false);
});
test("signal-only or unknown assessments cannot silently become reviewed truth", () => {
  for (const item of [{ ...trial, certainty: "reviewed" }, { ...trial, source: "observed", direction: "unknown", certainty: "reviewed" },
    { ...trial, source: "operator_report", severity: "unknown", certainty: "reviewed" }]) {
    assert.equal(schema.safeParse({ base_revision: 0, intervals: [item] }).success, false);
  }
});
test("stationary and movement semantics remain separate", () => {
  for (const item of [{ ...interval, direction: "reverse" }, { ...interval, severity: "harsh" }, { ...interval, movement: "driving" },
    { ...trial, movement: "automatic" }, { ...trial, unexpected: true }]) {
    assert.equal(schema.safeParse({ base_revision: 0, intervals: [item] }).success, false);
  }
});
test("swerve deviation round-trips independently of travel direction", () => {
  const swerve = { ...trial, movement: "swerving", initial_deviation: "right" };
  const parse = item => schema.safeParse({ base_revision: 0, intervals: [item] });
  assert.deepEqual(parse(swerve).data.intervals[0], swerve);
  assert.equal(parse({ ...swerve, initial_deviation: undefined }).success, true);
  assert.equal(parse({ ...swerve, initial_deviation: "forward" }).success, false);
  assert.equal(parse({ ...swerve, movement: "driving" }).success, false);
});
test("revision, interval count, notes and clock bounds match the request limits", () => {
  for (const base_revision of [-1, .5, 1001]) assert.equal(schema.safeParse({ base_revision, intervals: [] }).success, false);
  assert.equal(schema.safeParse({ base_revision: 0, intervals: Array(101).fill(interval) }).success, false);
  assert.equal(schema.safeParse({ base_revision: 0, intervals: [{ ...interval, notes: "x".repeat(1001) }] }).success, false);
  assert.equal(schema.safeParse({ base_revision: 0, intervals: [{ ...interval, end_ms: 86400001 }] }).success, false);
});
