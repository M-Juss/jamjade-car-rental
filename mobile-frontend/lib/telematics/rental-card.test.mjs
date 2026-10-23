import assert from 'node:assert/strict';
import test from 'node:test';
import { formatRentalDate, formatRentalDateCompact, rentalCardState } from './rental-card.ts';

function rental(state, overrides = {}) {
  return {
    eligibility: { state, canWorkSetup: false, setupStatus: 'setup_required' },
    rentalStartAt: '2026-10-18T06:30:00Z',
    hasSetupAttempts: false,
    ...overrides,
  };
}

test('confirmed bookings remain locked until the server permits setup', () => {
  for (const state of ['waiting_for_confirmation', 'verification_required', 'rental_scheduled', 'inspection_required', 'handover_preparation', 'other_rental_active']) {
    assert.equal(rentalCardState(rental(state)).canOpen, false);
  }
});

test('server permission opens setup and saved attempts change the action', () => {
  const current = rental('handover_in_progress', { eligibility: { state: 'handover_in_progress', canWorkSetup: true } });
  assert.equal(rentalCardState(current).action, 'Begin setup');
  assert.equal(rentalCardState({ ...current, hasSetupAttempts: true }).action, 'Continue setup');
});

test('ready results do not unlock a competing or expired rental', () => {
  const current = rental('other_rental_active', { eligibility: { state: 'other_rental_active', setupStatus: 'ready_for_release', canWorkSetup: false } });
  assert.equal(rentalCardState(current).canOpen, false);
  current.eligibility.state = 'handover_preparation';
  assert.equal(rentalCardState(current).action, 'View setup');
  assert.equal(rentalCardState({ ...current, rentalPeriodEnded: true }).canOpen, false);
});

test('staff-released ongoing rentals remain open even after the return deadline', () => {
  const result = rentalCardState(rental('released', { rentalPeriodEnded: true }));
  assert.equal(result.canOpen, true);
  assert.equal(result.action, 'Open rental');
});

test('rental dates use Manila time without timezone labels', () => {
  assert.match(formatRentalDate('2026-10-18T06:30:00Z'), /2:30/);
  assert.doesNotMatch(formatRentalDate('2026-10-18T06:30:00Z'), /PHT|UTC|Asia\/Manila/);
});

test('compact rental dates fit the card summary row', () => {
  const value = formatRentalDateCompact('2026-10-18T06:30:00Z');
  assert.match(value, /Oct 18/);
  assert.match(value, /2:30/);
  assert.doesNotMatch(value, /PHT|UTC|Asia\/Manila/);
});
