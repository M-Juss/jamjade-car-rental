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
  assert.equal(query.get('search'), 'Test Operator');
  assert.equal(query.get('vehicle_id'), '4');
  assert.equal(query.get('rental_type'), 'owners_driver');
  assert.equal(result.operatorAttention.threshold, 70);
});
