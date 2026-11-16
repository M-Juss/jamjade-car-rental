import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as zod from 'zod';
import { toBookingTimestamp } from '../../lib/browse/booking-time.ts';

function loadModule(path, apiPost = async () => ({ data: {} }), clock = Date) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Intl, Date: clock,
    require(name) {
      if (name === '@/services/http') return { apiPost };
      if (name === '@/lib/browse/booking-time' || name === './booking-time') return { toBookingTimestamp };
      if (name === '@/lib/browse/pickup-time') return loadModule('../../lib/browse/pickup-time.ts', apiPost, clock);
      if (name === '@/validation/booking/schemas') return loadModule('../../validation/booking/schemas.ts', apiPost, clock);
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

test('pickup validation accepts earlier times today using the Manila date across UTC midnight', () => {
  const { isBookablePickupDate, getLocalDateKey } = loadModule('../../lib/browse/pickup-time.ts');
  const now = new Date('2026-10-18T16:24:00Z');
  assert.equal(getLocalDateKey(now), '2026-10-19');
  assert.equal(isBookablePickupDate('2026-10-19 00:00', now), true);
  assert.equal(isBookablePickupDate('2026-10-19 00:24', now), true);
  assert.equal(isBookablePickupDate('2026-10-19 00:25', now), true);
  assert.equal(isBookablePickupDate('2026-10-18T16:00:00Z', now), true);
  assert.equal(isBookablePickupDate('2026-10-18 23:59', now), false);
  assert.equal(isBookablePickupDate('invalid', now), false);
});

test('the calendar advances to tomorrow once the last pickup time today has passed', () => {
  const { getEarliestPickupDate } = loadModule('../../lib/browse/pickup-time.ts');
  assert.equal(getEarliestPickupDate(new Date('2026-11-15T15:54:59Z')), '2026-11-15');
  assert.equal(getEarliestPickupDate(new Date('2026-11-15T15:55:00Z')), '2026-11-16');
  assert.equal(getEarliestPickupDate(new Date('2026-11-15T16:00:00Z')), '2026-11-16');
});

const clock = new Date('2026-11-15T04:00:00Z');
class BookingClock extends Date {
  constructor(...args) { super(...(args.length ? args : [clock.getTime()])); }
  static now() { return clock.getTime(); }
}

test('review accepts a selected pickup time after it passes on the same date', () => {
  const { bookingFormSchema } = loadModule('../../validation/booking/schemas.ts', undefined, BookingClock);
  const { canReviewBooking } = loadModule('../../lib/browse/booking-readiness.ts', undefined, BookingClock);
  const booking = { rentalDate: '2026-11-15', returnDate: '2026-11-16', deliveryTime: '12:05',
    driverOption: 'self_drive', pickupOption: 'shop', pickupLocation: 'Jamjade Garage', numberOfDays: 1,
    canSelfDrive: true, selfDriveMessage: '', ownerDriverCoverage: 'metro_manila' };
  assert.equal(bookingFormSchema.safeParse(booking).success, true);
  for (const deliveryTime of ['09:00', '12:00']) {
    const selected = { ...booking, deliveryTime };
    assert.equal(bookingFormSchema.safeParse(selected).success, true);
    assert.equal(canReviewBooking(selected, [], false), true);
    assert.equal(canReviewBooking(selected, [{ startDate: booking.rentalDate, endDate: booking.rentalDate }], false), false);
  }
  assert.equal(bookingFormSchema.safeParse({ ...booking, rentalDate: '2026-11-16', returnDate: '2026-11-17', deliveryTime: '09:00' }).success, true);
  assert.equal(bookingFormSchema.safeParse({ ...booking, rentalDate: '2026-11-14' }).success, false);
  assert.equal(bookingFormSchema.safeParse({ ...booking, deliveryTime: '' }).success, false);
  assert.equal(bookingFormSchema.safeParse({ ...booking, deliveryTime: '25:00' }).success, false);
  assert.equal(bookingFormSchema.safeParse({ ...booking, returnDate: booking.rentalDate }).success, false);
});

test('delivery can be confirmed after the selected pickup time on the same date', () => {
  const { deliveryRoutesSchema } = loadModule('../../validation/booking/delivery.ts', undefined, BookingClock);
  const delivery = { vehicleId: '1', rentalStartAt: '2026-11-15 12:05', rentalEndAt: '2026-11-16 09:00',
    ownerDriverCoverage: 'metro_manila', address: 'Demo address', placeId: null, latitude: 14, longitude: 121, pointConfirmed: true };
  assert.equal(deliveryRoutesSchema.safeParse(delivery).success, true);
  for (const rentalStartAt of ['2026-11-15 09:00', '2026-11-15 12:00']) {
    assert.equal(deliveryRoutesSchema.safeParse({ ...delivery, rentalStartAt }).success, true);
  }
  assert.equal(deliveryRoutesSchema.safeParse({ ...delivery, rentalStartAt: '2026-11-14 23:59' }).success, false);
  assert.equal(deliveryRoutesSchema.safeParse({ ...delivery, rentalEndAt: '2026-11-15 11:59' }).success, false);
  assert.equal(deliveryRoutesSchema.safeParse({ ...delivery, rentalEndAt: '2026-11-15 12:00' }).success, false);
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

test('pickup selection uses Manila instants across midnight and disables the current minute', () => {
  const { isFuturePickupTime, getLocalTimeKey } = loadModule('../../lib/browse/pickup-time.ts');
  const now = new Date('2026-11-14T16:24:30Z');
  assert.equal(getLocalTimeKey(now), '00:24');
  assert.equal(isFuturePickupTime('2026-11-15', '00:20', now), false);
  assert.equal(isFuturePickupTime('2026-11-15', '00:24', now), false);
  assert.equal(isFuturePickupTime('2026-11-15', '00:25', now), true);
  assert.equal(isFuturePickupTime('2026-11-14', '23:55', now), false);
  assert.equal(isFuturePickupTime('2026-11-16', '00:00', now), true);
});
