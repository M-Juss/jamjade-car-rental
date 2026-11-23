import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as zod from 'zod';

function load(path, imports) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require(name) {
    if (name in imports) return imports[name];
    throw new Error(`Unexpected import: ${name}`);
  } });
  return exports;
}

const validation = load('../../validation/booking/driver-workflow.ts', { zod });
const { mapBooking } = load('./booking.service.ts', { '@/services/http': { API_BASE_URL: 'https://example.test/api' } });
const record = {
  id: 'BK-TEST', bookingCode: 'BK-TEST', backendId: 42, status: 'Active', transmission: 'automatic', fuelType: 'gasoline',
  assignedDriver: { id: 9, name: 'Test Driver', email: 'driver@example.test', phoneNumber: '09170000885' },
  driverWorkflow: { status: 'arrived', arrivedAt: '2026-11-21T01:00:00Z', canStartRental: false },
};

test('driver workflow submits only an allowed action and preserves the authoritative resulting state', async () => {
  const calls = [];
  const { updateDriverWorkflow } = load('./driver-workflow.service.ts', {
    '@/services/http': { apiPost: async (path, body) => { calls.push({ path, body }); return { data: record }; } },
    '@/validation/booking/driver-workflow': validation,
    './booking.service': { mapBooking },
  });
  for (const action of ['on_way', 'arrived', 'start_rental']) {
    const result = await updateDriverWorkflow(42, { action, status: 'completed', driver_id: 77 });
    assert.equal(calls.at(-1).path, '/mobile/driver/services/42/workflow');
    assert.equal(Object.keys(calls.at(-1).body).join(','), 'action');
    assert.equal(calls.at(-1).body.action, action);
    assert.equal(result.status, 'Active');
    assert.equal(result.assignedDriver.email, 'driver@example.test');
    assert.equal(result.driverWorkflow.arrivedAt, record.driverWorkflow.arrivedAt);
  }
  await assert.rejects(updateDriverWorkflow(42, { action: 'complete_booking' }));
  assert.equal(calls.length, 3);
});

test('validation, authorization, expired booking and network errors do not produce a successful local update', async () => {
  for (const error of [new Error('422'), new Error('403'), new Error('expired'), new Error('offline')]) {
    const { updateDriverWorkflow } = load('./driver-workflow.service.ts', {
      '@/services/http': { apiPost: async () => { throw error; } },
      '@/validation/booking/driver-workflow': validation,
      './booking.service': { mapBooking },
    });
    await assert.rejects(updateDriverWorkflow(42, { action: 'start_rental' }), received => received === error);
  }
});
