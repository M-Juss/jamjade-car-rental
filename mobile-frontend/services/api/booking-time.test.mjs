import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as zod from 'zod';
import { toBookingTimestamp } from '../../lib/browse/booking-time.ts';

function loadModule(path, apiPost = async () => ({ data: {} })) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Intl, Date,
    require(name) {
      if (name === '@/services/http') return { apiPost };
      if (name === '@/lib/browse/booking-time' || name === './booking-time') return { toBookingTimestamp };
      if (name === 'zod') return zod;
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports;
}

test('Manila wall times keep their intended instant regardless of the device timezone', () => {
  for (const value of ['2026-10-18 21:25', '2026-10-18T21:25:00', '2026-10-18T21:25:00+08:00', '2026-10-18T13:25:00Z']) {
    assert.equal(new Date(toBookingTimestamp(value)).toISOString(), '2026-10-18T13:25:00.000Z');
  }
  assert.equal(new Date(toBookingTimestamp('2026-10-19 00:25')).toISOString(), '2026-10-18T16:25:00.000Z');
  assert.equal(new Date(toBookingTimestamp('2026-10-19')).toISOString(), '2026-10-18T16:00:00.000Z');
});

test('checkout and delivery quote requests send the same explicit booking timezone', async () => {
  const calls = [];
  const apiPost = async (path, payload) => { calls.push({ path, payload }); return { data: {} }; };
  const schedule = { vehicleId: '1', rentalStartAt: '2026-10-18 21:25', rentalEndAt: '2026-10-19 21:25' };
  const pricing = { pricePerDay: 1000, subtotal: 1000, deliveryFee: 0, deliveryTollFee: 0, ownerDriverFee: 0, totalAmount: 1000 };
  await loadModule('./payment.service.ts', apiPost).createPayPalOrder({ ...schedule, reviewedPricing: pricing });
  await loadModule('./delivery.service.ts', apiPost).confirmDeliveryLocation(schedule);
  assert.equal(calls.length, 2);
  for (const { payload } of calls) {
    assert.equal(payload.rental_start_at, '2026-10-18T21:25+08:00');
    assert.equal(payload.rental_end_at, '2026-10-19T21:25+08:00');
  }
});

test('quote matching accepts the corrected interval and rejects the old eight-hour shift', () => {
  const { quoteMatches } = loadModule('./delivery.service.ts');
  const quote = { vehicleId: '1', rentalStartAt: '2026-10-18T13:25:00Z', rentalEndAt: '2026-10-19T13:25:00Z', ownerDriverCoverage: 'metro_manila', destinationAddress: 'Demo address' };
  const matches = (changes) => quoteMatches({ ...quote, ...changes }, '1', '2026-10-18 21:25', '2026-10-19 21:25', 'metro_manila', 'Demo address');
  assert.equal(matches({}), true);
  assert.equal(matches({ rentalStartAt: '2026-10-18T21:25:00Z', rentalEndAt: '2026-10-19T21:25:00Z' }), false);
  assert.equal(matches({ rentalEndAt: '2026-10-20T13:25:00Z' }), false);
});

test('pickup validation and picker limits use the Manila date across UTC midnight', () => {
  const { isFuturePickupTime, getLocalDateKey, getLocalTimeKey } = loadModule('../../lib/browse/pickup-time.ts');
  const now = new Date('2026-10-18T16:24:00Z');
  assert.equal(getLocalDateKey(now), '2026-10-19');
  assert.equal(getLocalTimeKey(now), '00:24');
  assert.equal(isFuturePickupTime('2026-10-19', '00:25', now), true);
  assert.equal(isFuturePickupTime('2026-10-19', '00:24', now), false);
  assert.equal(isFuturePickupTime('2026-10-18', '23:59', now), false);
});

test('delivery validation compares the same instants that the API receives', () => {
  const { deliveryRoutesSchema } = loadModule('../../validation/booking/delivery.ts');
  const nextDay = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const values = { vehicleId: '1', rentalStartAt: `${nextDay} 21:25`, rentalEndAt: `${nextDay} 22:25`, ownerDriverCoverage: 'metro_manila', address: 'Demo address', placeId: null, latitude: 14, longitude: 121, pointConfirmed: true };
  assert.equal(deliveryRoutesSchema.safeParse(values).success, true);
  assert.equal(deliveryRoutesSchema.safeParse({ ...values, rentalStartAt: '2000-01-01 21:25' }).success, false);
  assert.equal(deliveryRoutesSchema.safeParse({ ...values, rentalEndAt: values.rentalStartAt }).success, false);
  assert.equal(deliveryRoutesSchema.safeParse({ ...values, rentalEndAt: 'invalid' }).success, false);
});
