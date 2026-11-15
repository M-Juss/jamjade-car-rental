import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

class ApiError extends Error {
  constructor(status, errors) { super('Request rejected'); this.status = status; this.errors = errors; }
}

function harness({ error, submitting = false } = {}) {
  const errors = [];
  const cancelled = [];
  const requests = [];
  let closes = 0;
  const updated = { id: 'BK-42', status: 'Cancelled', canCancelUnpaid: false };
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const source = ts.transpileModule(readFileSync(new URL('./CancelBookingForm.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, require(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react') return { useEffect: (effect) => effect() };
    if (name === 'react-native') return { Text: 'Text', View: 'View' };
    if (name === '@hookform/resolvers/zod') return { zodResolver: () => ({}) };
    if (name === 'react-hook-form') return { Controller: 'Controller', useForm: () => ({
      control: {}, reset: () => {}, formState: { errors: {}, isSubmitting: submitting },
      setError: (field, value) => errors.push({ field, message: value.message }),
      handleSubmit: (callback) => () => callback({ reason: 'Change of plans' }),
    }) };
    if (name === '@/services/api/booking.service') return { cancelUnpaidBooking: async (id, values) => {
      requests.push({ id, values });
      if (error) throw error;
      return updated;
    } };
    if (name === '@/services/http') return { ApiError };
    if (name === '@/validation/booking/cancellation') return { cancelUnpaidBookingSchema: {} };
    for (const component of ['ActionButton', 'KeyboardFormScrollView', 'ProfileFormSheet', 'FormInput']) {
      if (name.endsWith(`/${component}`)) return { [component]: component };
    }
    throw new Error(`Unexpected form dependency: ${name}`);
  } });
  const tree = exports.CancelBookingForm({ bookingId: 'BK-42', visible: true,
    onClose: () => closes++, onCancelled: (booking) => cancelled.push(booking) });
  const buttons = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ActionButton') buttons.push(node);
    for (const child of [node.props?.children].flat(Infinity)) visit(child);
  };
  visit(tree);
  return {
    errors, cancelled, requests, buttons, updated,
    confirm: () => buttons[0].props.onPress(),
    keep: () => buttons[1].props.onPress(),
    close: () => tree.props.onClose(),
    closes: () => closes,
  };
}

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test('keeping the booking closes confirmation without a cancellation request', () => {
  const h = harness();
  h.keep();
  assert.equal(h.closes(), 1);
  assert.equal(h.requests.length, 0);
  assert.equal(h.cancelled.length, 0);
});

test('successful confirmation applies only the booking returned by Laravel', async () => {
  const h = harness();
  h.confirm();
  await flush();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].id, 'BK-42');
  assert.equal(h.requests[0].values.reason, 'Change of plans');
  assert.equal(h.cancelled[0], h.updated);
  assert.equal(h.errors.length, 0);
});

test('Laravel reason errors remain on the field and do not report success', async () => {
  const h = harness({ error: new ApiError(422, { reason: ['Enter a reason.'] }) });
  h.confirm();
  await flush();
  assert.equal(h.errors.find((error) => error.field === 'reason').message, 'Enter a reason.');
  assert.equal(h.errors.find((error) => error.field === 'root').message, 'Enter a reason.');
  assert.equal(h.cancelled.length, 0);
});

test('payment-state rejection, lost eligibility and network failures remain recoverable errors', async () => {
  for (const [error, expected] of [
    [new ApiError(422, { booking: ['Resolve payment confirmation first.'] }), 'Resolve payment confirmation first.'],
    [new ApiError(403), 'This booking can no longer be cancelled. Refresh its details.'],
    [new ApiError(0), 'Cancellation could not be confirmed. Close this form and check the booking.'],
  ]) {
    const h = harness({ error });
    h.confirm();
    await flush();
    assert.equal(h.errors.find((error) => error.field === 'root').message, expected);
    assert.equal(h.cancelled.length, 0);
  }
});

test('pending cancellation disables both actions and prevents closing the sheet', () => {
  const h = harness({ submitting: true });
  assert.equal(h.buttons[0].props.disabled, true);
  assert.equal(h.buttons[1].props.disabled, true);
  assert.equal(h.buttons[0].props.label, 'Cancelling…');
  h.close();
  h.keep();
  assert.equal(h.closes(), 0);
});
