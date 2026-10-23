import assert from 'node:assert/strict';
import test from 'node:test';

import { formatRentalDuration, rentalTiming, rentalTripLabel, rentalVehicleName } from './rental-dashboard.ts';

const released = '2026-10-18T01:00:00Z';
const due = '2026-10-19T01:00:00Z';

test('elapsed rental time starts at staff release and the deadline stays fixed', () => {
  const result = rentalTiming(released, due, Date.parse('2026-10-18T02:30:00Z'));
  assert.equal(result.elapsedMs, 90 * 60_000);
  assert.equal(result.remainingMs, 22.5 * 60 * 60_000);
  assert.equal(result.returnDue, false);
  assert.equal(result.overdueMs, 0);
});

test('an elapsed return deadline keeps elapsed rental time running without changing rental state', () => {
  const now = Date.parse(due);
  const atDeadline = rentalTiming(released, due, now);
  assert.equal(atDeadline.returnDue, true);
  assert.equal(atDeadline.remainingMs, 0);
  assert.equal(atDeadline.overdueMs, 0);
  const later = rentalTiming(released, due, now + 2 * 60 * 60_000);
  assert.equal(later.elapsedMs, 26 * 60 * 60_000);
  assert.equal(later.overdueMs, 2 * 60 * 60_000);
});

test('missing or invalid timestamps stay unavailable rather than inventing a timer', () => {
  for (const value of [null, undefined, '', 'invalid']) {
    const result = rentalTiming(value, value, Date.parse(released));
    assert.equal(result.elapsedMs, null);
    assert.equal(result.remainingMs, null);
    assert.equal(result.returnDue, false);
    assert.equal(formatRentalDuration(result.elapsedMs), '—');
  }
  assert.equal(rentalTiming(released, due, Date.parse(released) - 60_000).elapsedMs, 0);
});

test('duration labels handle minute, hour and day boundaries', () => {
  assert.equal(formatRentalDuration(59_999), 'Less than 1m');
  assert.equal(formatRentalDuration(60_000), '1m');
  assert.equal(formatRentalDuration(90 * 60_000), '1h 30m');
  assert.equal(formatRentalDuration(26 * 60 * 60_000), '1d 2h');
});

test('trip labels reflect saved records without suggesting mobile monitoring is running', () => {
  assert.equal(rentalTripLabel(null), 'Not started');
  assert.equal(rentalTripLabel(undefined), 'Not started');
  assert.equal(rentalTripLabel('started'), 'Started');
  assert.equal(rentalTripLabel('paused'), 'Paused');
  assert.equal(rentalTripLabel('ended'), 'Ended');
});

test('vehicle title uses the saved name once and supports missing vehicle details', () => {
  assert.equal(rentalVehicleName({ vehicleName: 'Toyota Vios', brand: 'Toyota', model: 'Vios' }), 'Toyota Vios');
  assert.equal(rentalVehicleName({ vehicleName: '', brand: 'Toyota', model: 'Vios' }), 'Toyota Vios');
  assert.equal(rentalVehicleName(undefined), 'Your vehicle');
});
