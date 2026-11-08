import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';
import { collectionFixture as fixture } from './collection-fixture.mjs';
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;

const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./collection.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, require: name => { assert.equal(name, 'zod'); return { z }; } });
const { collectionContextSchema, observationInputSchema, observationUploadSchema } = exports;
test('metadata preserves integer nanosecond subtraction beyond JavaScript safe integers', () => {
  assert.equal(collectionContextSchema.safeParse(fixture()).success, true);
});
for (const [name, change] of [
  ['invented pass', v => { v.preflight.result = 'passed'; }],
  ['invented alignment', v => { v.mount.alignment_status = 'accepted'; }],
  ['cross-session mount', v => { v.mount.research_session_id = id(8); }],
  ['cross-mount check', v => { v.preflight.mount_version_id = id(8); }],
  ['clock overflow', v => { v.preflight.end_elapsed_ns = '9223372036854775808'; }],
  ['inconsistent window', v => { v.preflight.window_ms = 5001; }],
  ['consent after collection', v => { v.preflight.consented_at = '2026-11-06T00:00:02Z'; }],
  ['missing measured mean', v => { v.preflight.measurements.accelerometer.mean = null; }],
  ['unconfirmed mount', v => { v.preflight.holder_locked = false; }],
]) test(`metadata rejects ${name}`, () => { const input = fixture(); change(input); assert.equal(collectionContextSchema.safeParse(input).success, false); });

test('observations preserve uncertainty and need independent observer provenance', () => {
  const input = { base_revision: 0, completed_as_planned: null, source: 'operator_report', observer_code: null, flags: [], actual_stop_method: 'unknown', notes: null };
  assert.equal(observationInputSchema.safeParse(input).success, true);
  assert.equal(observationInputSchema.safeParse({ ...input, source: 'observed' }).success, false);
  assert.equal(observationInputSchema.safeParse({ ...input, flags: ['bump', 'bump'] }).success, false);
  assert.equal(observationInputSchema.safeParse({ ...input, actual_stop_method: 'harsh' }).success, false);
  const upload = { ...input, id: id(1), reported_at: '2026-11-07T00:00:00Z' };
  assert.equal(observationUploadSchema.parse({ ...upload, initial_deviation: 'right' }).initial_deviation, 'right');
  assert.equal(observationUploadSchema.safeParse({ ...upload, initial_deviation: 'forward' }).success, false);
  assert.equal('initial_deviation' in observationUploadSchema.parse(upload), false);
});

test('all deployed protocol snapshots match the approved provisional catalog byte for byte', () => {
  const root = new URL('../../', import.meta.url);
  const canonical = readFileSync(new URL('../docs/contracts/rc-collection-v1/catalog.json', root), 'utf8');
  for (const path of ['assets/research/rc-exercises-v1.json', 'modules/rc-recorder/android/src/main/assets/rc-exercises-v1.json', '../backend/resources/research/rc-exercises-v1.json', '../web-frontend/src/modules/management/research/rc-exercises-v1.json']) {
    assert.equal(readFileSync(new URL(path, root), 'utf8'), canonical);
  }
});

test('v2 deploys consistently while preserving historical v1 instructions', () => {
  const root = new URL('../../', import.meta.url);
  const canonical = readFileSync(new URL('../docs/contracts/rc-collection-v1/catalog-v2.json', root), 'utf8');
  for (const path of ['assets/research/rc-exercises-v2.json', 'modules/rc-recorder/android/src/main/assets/rc-exercises-v2.json', '../backend/resources/research/rc-exercises-v2.json', '../web-frontend/src/modules/management/research/rc-exercises-v2.json']) {
    assert.equal(readFileSync(new URL(path, root), 'utf8'), canonical);
  }
  const catalog = JSON.parse(canonical);
  for (const code of ['FSS', 'FR', 'HA', 'LT', 'RT', 'RSS', 'SW']) assert.equal(catalog.protocols.find(p => p.code === code).expected_stop_method, 'neutral_release');
  assert.equal(catalog.protocols.find(p => p.code === 'HB').planned_assessment, 'harsh_attempt');
  assert.equal(catalog.protocols.find(p => p.code === 'HB').expected_stop_method, 'brake_applied');
  const old = JSON.parse(readFileSync(new URL('assets/research/rc-exercises-v1.json', root), 'utf8'));
  assert.equal(old.protocols.find(p => p.code === 'FSS').expected_stop_method, 'brake_applied');
  const input = fixture(); input.catalog_version = 'rc-exercises-v2';
  assert.equal(collectionContextSchema.safeParse(input).success, true); // Existing session is preserved.
  input.session.catalog_version = 'rc-exercises-v2';
  assert.equal(collectionContextSchema.safeParse(input).success, true);
  input.catalog_version = 'rc-exercises-v99';
  assert.equal(collectionContextSchema.safeParse(input).success, false);
});

test('v3 keeps earlier protocols and binds both harsh turns in an existing session', () => {
  const root = new URL('../../', import.meta.url);
  const canonical = readFileSync(new URL('../docs/contracts/rc-collection-v1/catalog-v3.json', root), 'utf8');
  for (const path of ['assets/research/rc-exercises-v3.json', 'modules/rc-recorder/android/src/main/assets/rc-exercises-v3.json', '../backend/resources/research/rc-exercises-v3.json', '../web-frontend/src/modules/management/research/rc-exercises-v3.json']) {
    assert.equal(readFileSync(new URL(path, root), 'utf8'), canonical);
  }
  const { protocols } = JSON.parse(canonical);
  const previous = JSON.parse(readFileSync(new URL('assets/research/rc-exercises-v2.json', root), 'utf8'));
  assert.deepEqual(protocols.filter(p => p.code !== 'HLT' && p.code !== 'HRT'), previous.protocols);
  for (const [code, layout] of [['HLT', 'left_turn'], ['HRT', 'right_turn']]) {
    const protocol = protocols.find(p => p.code === code);
    assert.equal(protocol.planned_assessment, 'harsh_attempt');
    assert.equal(protocol.layout_key, layout);
    assert.equal(protocol.expected_stop_method, 'neutral_release');
    const input = { ...fixture(), protocol_code: code, catalog_version: 'rc-exercises-v3' };
    assert.equal(collectionContextSchema.safeParse(input).success, true);
    assert.equal(collectionContextSchema.safeParse({ ...input, catalog_version: 'rc-exercises-v2' }).success, false);
  }
});
