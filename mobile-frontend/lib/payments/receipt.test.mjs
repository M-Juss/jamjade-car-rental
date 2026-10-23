import assert from 'node:assert/strict';
import test from 'node:test';
import { formatReceiptAmount, formatReceiptDate, receiptFilename, receiptSuccessRoute } from './receipt.ts';

test('receipt amounts always preserve centavos and show two decimal places', () => {
  assert.match(formatReceiptAmount(1750), /1,750\.00/);
  assert.match(formatReceiptAmount(1750.5), /1,750\.50/);
  assert.match(formatReceiptAmount(0), /0\.00/);
});

test('dates show the Manila calendar date without a timezone suffix', () => {
  const text = formatReceiptDate('2026-10-15T16:30:00Z');
  assert.match(text, /Oct 16, 2026/);
  assert.match(text, /12:30 AM/);
  assert.doesNotMatch(text, /PHT|UTC|Manila|GMT/);
});

test('missing historical timestamps are never invented', () => {
  assert.equal(formatReceiptDate(null), 'Not provided');
  assert.equal(formatReceiptDate('invalid'), 'Not provided');
});

test('download names cannot introduce path components', () => {
  assert.equal(receiptFilename({ bookingReference: 'BK-123', receiptReference: 'RCP-00000001' }), 'BK-123-Receipt-RCP-00000001.jpg');
  assert.doesNotMatch(receiptFilename({ bookingReference: '../../unsafe', receiptReference: 'test/name' }), /[/\\]/);
});

test('success navigation identifies the exact order without passing financial claims', () => {
  const path = receiptSuccessRoute('ORDER+1&test', 'BK-123');
  const query = new URL(path, 'https://example.test').searchParams;
  assert.equal(query.get('orderId'), 'ORDER+1&test');
  assert.equal(query.get('reference'), 'BK-123');
  assert.equal(query.get('remainingBalance'), null);
  assert.equal(query.get('paymentStatus'), null);
});
