import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as zod from 'zod';

function module(path, imports) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require(name) {
    if (name in imports) return imports[name];
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return exports;
}

const { cancelUnpaidBookingSchema: schema } = module('../../validation/booking/cancellation.ts', { zod });

test('the cancellation form trims a required reason and mirrors Laravel’s 1,000-character limit', () => {
  assert.equal(schema.parse({ reason: '  Change of plans  ' }).reason, 'Change of plans');
  for (const reason of [undefined, null, '', '  ', ['array'], 'x'.repeat(1001), '🚗'.repeat(1001)]) {
    assert.equal(schema.safeParse({ reason }).success, false);
  }
  for (const reason of ['x'.repeat(1000), '🚗'.repeat(1000)]) {
    assert.equal(schema.safeParse({ reason }).success, true);
  }
});

const record = {
  id: '42', backendId: 42, bookingCode: 'BK-00042', status: 'Cancelled', paymentStatus: 'Unpaid',
  canCancelUnpaid: false, canReviseUnpaid: false, transmission: 'automatic', fuelType: 'gasoline',
  cancellation: { kind: 'customer_unpaid', reason: 'Change of plans', refundStatus: 'not_eligible', refundAmount: 0 },
};

test('cancellation sends only the reason and maps the server’s resulting booking and eligibility', async () => {
  const calls = [];
  const service = module('./booking.service.ts', { '@/services/http': {
    API_BASE_URL: 'https://backend.example.test/api',
    apiPost: async (path, body) => { calls.push({ path, body }); return { data: record }; },
  } });
  const result = await service.cancelUnpaidBooking('BK/42', { reason: 'Change of plans', refund_amount: 3500 });
  assert.equal(calls[0].path, '/mobile/bookings/BK%2F42/cancel');
  assert.equal(Object.keys(calls[0].body).join(','), 'reason');
  assert.equal(calls[0].body.reason, 'Change of plans');
  assert.equal(result.status, 'Cancelled');
  assert.equal(result.canCancelUnpaid, false);
  assert.equal(result.canReviseUnpaid, false);
  assert.equal(result.cancellation.kind, 'customer_unpaid');
  assert.equal(result.cancellation.refundStatus, 'not_eligible');
  assert.equal(service.mapBooking({ ...record, status: 'Pending', canCancelUnpaid: true }).canCancelUnpaid, true);
});

test('server validation, payment-state rejection and network failure reach the form without a false success', async () => {
  for (const error of [new Error('Validation rejected'), new Error('Payment confirmation pending'), new Error('Network unavailable')]) {
    const service = module('./booking.service.ts', { '@/services/http': {
      API_BASE_URL: 'https://backend.example.test/api', apiPost: async () => { throw error; },
    } });
    await assert.rejects(service.cancelUnpaidBooking('BK-00042', { reason: 'Change of plans' }), (received) => received === error);
  }
});
