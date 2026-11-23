import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as zod from 'zod';

function load(path, imports = {}) {
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

const validation = load('../../validation/booking/feedback.ts', { zod });

test('feedback validates stars and optional comments and sends only the customer review contract', async () => {
  const calls = [];
  const saved = { id: 8, rating: 4, comment: 'Good service.' };
  const { submitBookingFeedback } = load('./feedback.service.ts', {
    '@/validation/booking/feedback': validation,
    '@/services/http': { apiPost: async (path, body) => { calls.push({ path, body }); return { data: saved }; } },
  });
  assert.equal(await submitBookingFeedback(42, { rating: 4, comment: ' Good service. ', is_featured: true }), saved);
  assert.equal(calls[0].path, '/mobile/bookings/42/feedback');
  assert.equal(JSON.stringify(calls[0].body), JSON.stringify({ rating: 4, comment: 'Good service.' }));
  await submitBookingFeedback(42, { rating: 1 });
  assert.equal(calls[1].body.comment, null);
  for (const rating of [0, 6, 2.5, null]) await assert.rejects(submitBookingFeedback(42, { rating }));
  await assert.rejects(submitBookingFeedback(42, { rating: 5, comment: 'x'.repeat(1001) }));
  assert.equal(calls.length, 2);
  await submitBookingFeedback(42, { rating: 5, comment: '🌟'.repeat(1000) });
  assert.equal(Array.from(calls[2].body.comment).length, 1000);
});

test('submission failures remain failures so the booking cannot show an unsaved review', async () => {
  for (const failure of [new Error('422'), new Error('403'), new Error('409'), new Error('offline')]) {
    const { submitBookingFeedback } = load('./feedback.service.ts', {
      '@/validation/booking/feedback': validation,
      '@/services/http': { apiPost: async () => { throw failure; } },
    });
    await assert.rejects(submitBookingFeedback(42, { rating: 5 }), error => error === failure);
  }
});

test('feedback actions belong only to completed eligible bookings and become View feedback after submission', () => {
  const icons = Object.fromEntries(['Car', 'ClipboardList', 'CreditCard', 'Navigation', 'RefreshCcw', 'Star'].map(name => [name, name]));
  const { getBookingActions } = load('../../components/bookings/booking-actions.ts', { 'lucide-react-native': icons });
  const findFeedback = (status, options) => getBookingActions(status, options).find(action => action.key === 'feedback');
  for (const status of ['Pending', 'Confirmed', 'Active', 'Ongoing', 'Returned', 'Cancelled', 'Rejected', 'No-show']) {
    assert.equal(findFeedback(status, { canLeaveFeedback: true }), undefined);
  }
  assert.equal(findFeedback('Completed'), undefined);
  assert.equal(findFeedback('Completed', { canLeaveFeedback: true }).label, 'Leave feedback');
  assert.equal(findFeedback('Completed', { hasFeedback: true }).label, 'View feedback');
});
