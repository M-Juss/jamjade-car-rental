import assert from 'node:assert/strict';
import test from 'node:test';
import { ReleaseMonitoringPreparation } from './release-monitoring.ts';

const context = { userId: 5, bookingCode: 'DEMO', startedAt: '2026-10-19T00:00:00Z', profile: 'demo-profile' };
const consent = { consent: true, consent_version: 2, sharing_mode: 'foreground_background' };

test('prepared consent starts nothing before server release, monitoring eligibility and foreground availability', () => {
  const pending = new ReleaseMonitoringPreparation();
  assert.equal(pending.take(context, true, true, true, 2), null);
  pending.arm(context, consent, true);
  assert.equal(pending.take(context, false, true, true, 2), null);
  assert.equal(pending.take(context, true, false, true, 2), null);
  assert.equal(pending.take(context, true, true, false, 2), null);
  assert.deepEqual(pending.take(context, true, true, true, 2), { consent, includeMotion: true });
  assert.equal(pending.take(context, true, true, true, 2), null);
});

test('stopping, cancellation, leaving the screen and a fresh runtime cannot automatically restart GPS', () => {
  const pending = new ReleaseMonitoringPreparation();
  pending.arm(context, consent);
  pending.clear();
  assert.equal(pending.take(context, true, true, true, 2), null);
  pending.arm(context, consent);
  assert.deepEqual(pending.take(context, true, true, true, 2), { consent, includeMotion: false });
  // Startup failure, a later Stop or a later server refresh cannot reuse consent.
  assert.equal(pending.take(context, true, true, true, 2), null);
  assert.equal(new ReleaseMonitoringPreparation().take(context, true, true, true, 2), null);
});

test('prepared consent cannot cross customers, bookings, handovers, calibration profiles or terms versions', () => {
  for (const change of [{ userId: 6 }, { bookingCode: 'OTHER' }, { startedAt: 'later' }, { profile: 'changed' }]) {
    const pending = new ReleaseMonitoringPreparation();
    pending.arm(context, consent);
    assert.equal(pending.take({ ...context, ...change }, true, true, true, 2), null);
    assert.equal(pending.take(context, true, true, true, 2), null);
  }
  const pending = new ReleaseMonitoringPreparation();
  pending.arm(context, consent);
  assert.equal(pending.take(context, true, true, true, 3), null);
  assert.equal(pending.take(context, true, true, true, 2), null);
});
