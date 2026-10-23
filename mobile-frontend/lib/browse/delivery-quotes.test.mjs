import assert from 'node:assert/strict';
import test from 'node:test';
import { isReadyDeliveryQuote } from './delivery-quotes.ts';

const now = Date.parse('2030-01-01T00:00:00Z');
const quote = {
  status: 'ready', requiresRequote: false,
  expiresAt: new Date(now + 15 * 60_000).toISOString(),
  rentalStartAt: new Date(now + 24 * 60 * 60_000).toISOString(),
  destinationPoint: { latitude: 0, longitude: 0 },
};

test('a ready current-policy quote can continue only before its exact expiry', () => {
  assert.equal(isReadyDeliveryQuote(quote, now), true);
  assert.equal(isReadyDeliveryQuote(quote, Date.parse(quote.expiresAt)), false);
  for (const expiresAt of [null, '', 'invalid', new Date(now - 1).toISOString()]) {
    assert.equal(isReadyDeliveryQuote({ ...quote, expiresAt }, now), false);
  }
});

test('legacy quotes cannot unlock review or checkout', () => {
  for (const status of ['ready', 'awaiting_review', 'rejected', 'expired']) {
    const legacy = { ...quote, status, requiresRequote: true };
    assert.equal(isReadyDeliveryQuote(legacy, now), false);
  }
});

test('unavailable and consumed quotes cannot unlock review or checkout', () => {
  assert.equal(isReadyDeliveryQuote(null, now), false);
  assert.equal(isReadyDeliveryQuote(undefined, now), false);
  for (const status of ['offered', 'awaiting_review', 'consumed', 'superseded', 'rejected', 'expired']) {
    assert.equal(isReadyDeliveryQuote({ ...quote, status }, now), false);
  }
});

