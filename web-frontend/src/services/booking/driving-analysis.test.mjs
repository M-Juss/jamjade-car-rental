import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';

function load(file, imports) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports, URLSearchParams, require(name) {
    if (name in imports) return imports[name];
    throw new Error(`Unexpected dependency ${name}`);
  } });
  return exports;
}

const schemas = load('../../validations/driving-analysis/schemas.ts', { zod: { z } });

test('operator type queries mirror the nullable Laravel customer/driver enum', () => {
  for (const operator_type of [undefined, null, 'customer', 'driver']) {
    assert.equal(schemas.drivingAnalysisQuerySchema.safeParse({ operator_type }).success, true);
  }
  for (const operator_type of ['all', 'staff', 1, ['driver']]) {
    assert.equal(schemas.drivingAnalysisQuerySchema.safeParse({ operator_type }).success, false);
  }
});

test('operator and dialog queries send the type filter and keep server totals and type metadata', async () => {
  const calls = [];
  const record = { id: 7, name: 'Test Operator', operator_type: 'driver', completed_rentals: 12 };
  const service = load('./booking.service.ts', {
    '@/validations/booking/decision': {},
    '@/validations/driving-analysis/schemas': schemas,
    '@/services/management/navigation.service': {},
    '@/lib/table-pagination': { TABLE_PAGE_SIZE: 10 },
    '@/services/vehicle/vehicle.service': {},
    '@/services/http': { apiGet: async (url) => {
      calls.push(url);
      return { data: [record], meta: { total: 12, last_page: 2, summary: { completed_rentals: 12 } } };
    } },
  });
  const result = await service.getDrivingOperators({ page: 2, search: 'Test', operatorType: 'driver' });
  const query = new URL(calls[0], 'https://example.test').searchParams;
  assert.equal(query.get('operator_type'), 'driver');
  assert.equal(query.get('page'), '2');
  assert.equal(query.get('search'), 'Test');
  assert.equal(result.operators[0].operator_type, 'driver');
  assert.equal(result.total, 12);
  assert.equal(result.summary.completed_rentals, 12);
  await service.getDrivingAnalysisBookings({ page: 1, search: '', operatorId: '7', operatorType: 'driver' });
  const dialogQuery = new URL(calls[1], 'https://example.test').searchParams;
  assert.equal(dialogQuery.get('operator_id'), '7');
  assert.equal(dialogQuery.get('operator_type'), 'driver');
  await service.getDrivingOperators({ page: 1, search: '', operatorType: null });
  assert.equal(new URL(calls[2], 'https://example.test').searchParams.has('operator_type'), false);
  await assert.rejects(service.getDrivingOperators({ page: 1, search: '', operatorType: 'staff' }));
  assert.equal(calls.length, 3);
});

test('report drilldowns keep completion period, grade-only scope, literal search and vehicle together', async () => {
  const calls = [];
  const service = load('./booking.service.ts', {
    '@/validations/booking/decision': {},
    '@/validations/driving-analysis/schemas': schemas,
    '@/services/management/navigation.service': {},
    '@/lib/table-pagination': { TABLE_PAGE_SIZE: 10 },
    '@/services/vehicle/vehicle.service': {},
    '@/services/http': { apiGet: async url => { calls.push(url); return { data: [], meta: { total: 0 } }; } },
  });
  await service.getDrivingAnalysisBookings({ page: 2, search: '100%', operatorId: '7', operatorType: 'driver', vehicleId: '4',
    period: 'month', date: '2026-01-01', gradedOnly: true });
  const query = new URL(calls[0], 'https://example.test').searchParams;
  assert.equal(query.get('period'), 'month');
  assert.equal(query.get('date'), '2026-01-01');
  assert.equal(query.get('graded_only'), '1');
  assert.equal(query.get('operator_type'), 'driver');
  assert.equal(query.get('vehicle_id'), '4');
  assert.equal(query.get('search'), '100%');
  assert.equal(query.get('page'), '2');
  for (const scope of [{ period: 'month' }, { date: '2026-01-01' }, { period: 'hour', date: '2026-01-01' },
    { period: 'month', date: '2026-02-30' }, { period: 'month', date: '9999-01-01' }, { period: 'month', date: '1899-01-01' }]) {
    await assert.rejects(service.getDrivingAnalysisBookings({ page: 1, search: '', ...scope }));
  }
  for (const graded_only of [true, false, 0, 1, '0', '1']) assert.equal(schemas.drivingAnalysisQuerySchema.safeParse({ graded_only }).success, true);
  assert.equal(schemas.drivingAnalysisQuerySchema.safeParse({ graded_only: 'yes' }).success, false);
  assert.equal(calls.length, 1);
});
