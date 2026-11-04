import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as zod from "zod";

const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("./processing-run.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, require: name => { assert.equal(name, "zod"); return zod; } });
const { processingRequestSchema: schema } = exports;
const base = { start_ms: 0, end_ms: 8000, cutoff_hz: 5, confirmed: true };
const fit = { ...base, ranges: { rest: [0, 5000], starting: [5200, 6000], stopping: [6400, 7200] } };
const reuse = { ...base, reference_run_id: "11111111-1111-4111-8111-111111111111", same_mount_confirmed: true };

test("processing accepts fitting or reuse without changing their separate contracts", () => {
  for (const cutoff of [3, 5, 8]) for (const input of [fit, reuse]) {
    const result = schema.parse({ ...input, cutoff_hz: cutoff });
    assert.equal(result.cutoff_hz, cutoff);
    assert.equal("ranges" in result, input === fit);
    assert.equal("reference_run_id" in result, input === reuse);
  }
});

test("reuse rejects unconfirmed mounts, missing identifiers and copied target phase labels", () => {
  for (const change of [{ same_mount_confirmed: false }, { same_mount_confirmed: undefined }, { reference_run_id: "" },
    { reference_run_id: null }, { confirmed: false }, { ranges: fit.ranges }]) {
    assert.equal(schema.safeParse({ ...reuse, ...change }).success, false);
  }
  assert.equal(schema.safeParse({ ...fit, same_mount_confirmed: true }).success, false);
});

test("both contracts keep bounded finite windows and experimental cutoffs", () => {
  for (const input of [fit, reuse]) for (const change of [{ start_ms: -1 }, { start_ms: NaN }, { end_ms: Infinity },
    { end_ms: 30001 }, { end_ms: 0 }, { cutoff_hz: 4 }, { cutoff_hz: 5.5 }]) {
    assert.equal(schema.safeParse({ ...input, ...change }).success, false);
  }
  assert.equal(schema.safeParse({ ...reuse, start_ms: 30000, end_ms: 60000 }).success, true);
});

test("fitting retains ordered half-second minimum phases inside its own window", () => {
  for (const ranges of [{ ...fit.ranges, starting: [4900, 6000] }, { ...fit.ranges, rest: [0, 499] },
    { ...fit.ranges, stopping: [6400, 8100] }, { ...fit.ranges, rest: [0, 5000, 5100] }]) {
    assert.equal(schema.safeParse({ ...fit, ranges }).success, false);
  }
});
