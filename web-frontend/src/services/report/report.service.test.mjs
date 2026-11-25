import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

test('attention pagination is independent and keeps the existing report filters', async () => {
  const calls = [];
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('./report.service.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const data = { operatorAttention: { operators: [], threshold: 70, total: 0 } };
  vm.runInNewContext(source, { exports, URLSearchParams, require(name) {
    if (name === '@/services/http') return { apiGet: async path => { calls.push(path); return { data }; } };
    if (name === '@/lib/table-pagination') return { TABLE_PAGE_SIZE: 10 };
    throw new Error(`Unexpected import: ${name}`);
  } });
  const result = await exports.getReports({ section: 'telematics', period: 'month', date: '2026-01-01', page: 3, operatorPage: 2,
    search: 'Test Operator', vehicleId: 4, rentalType: 'owners_driver' });
  const query = new URL(calls[0], 'https://example.test').searchParams;
  assert.equal(query.get('operator_page'), '2');
  assert.equal(query.get('page'), '3');
  assert.equal(query.get('per_page'), '10');
  assert.equal(query.get('search'), 'Test Operator');
  assert.equal(query.get('vehicle_id'), '4');
  assert.equal(query.get('rental_type'), 'owners_driver');
  assert.equal(result.operatorAttention.threshold, 70);
});

test('combined CSV download preserves scope and credentials, excludes selected tab and pagination, and uses server filename', async () => {
  const calls = [];
  const links = [];
  const revoked = [];
  const blob = {};
  const source = ts.transpileModule(readFileSync(new URL('./report.service.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, URLSearchParams,
    fetch: async (url, options) => { calls.push({ url, options }); return { ok: true,
      headers: { get: () => 'attachment; filename="JamJade-Reports-and-Analytics-Month-Nov-2026.csv"' }, blob: async () => blob }; },
    URL: { createObjectURL(value) { assert.equal(value, blob); return 'blob:combined'; }, revokeObjectURL: value => revoked.push(value) },
    document: { createElement() { const link = { click() { this.clicked = true; }, remove() { this.removed = true; } }; links.push(link); return link; }, body: { appendChild() {} } },
    require(name) {
      if (name === '@/services/http') return { buildApiUrl: path => `http://127.0.0.1:8103${path}` };
      if (name === '@/lib/table-pagination') return { TABLE_PAGE_SIZE: 10 };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  await exports.downloadReport({ section: 'fleet', period: 'month', date: '2026-11-25', page: 4, operatorPage: 2,
    search: 'Car, 100%', vehicleId: 7, rentalType: 'self_drive' });
  const query = new URL(calls[0].url).searchParams;
  assert.equal(query.get('export_scope'), 'all');
  assert.equal(query.get('period'), 'month');
  assert.equal(query.get('date'), '2026-11-25');
  assert.equal(query.get('search'), 'Car, 100%');
  assert.equal(query.get('vehicle_id'), '7');
  assert.equal(query.get('rental_type'), 'self_drive');
  for (const key of ['section', 'page', 'operator_page', 'per_page']) assert.equal(query.has(key), false);
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(links[0].download, 'JamJade-Reports-and-Analytics-Month-Nov-2026.csv');
  assert.equal(links[0].clicked, true);
  assert.equal(links[0].removed, true);
  assert.deepEqual(revoked, ['blob:combined']);
});
