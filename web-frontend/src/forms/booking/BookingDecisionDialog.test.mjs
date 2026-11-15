import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { z } from 'zod/v3';

function load(file, imports) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, require(name) {
    if (name in imports) return imports[name];
    throw new Error(`Unexpected dependency ${name}`);
  } });
  return exports;
}
const schemas = load('../../validations/booking/decision.ts', { 'zod/v3': { z } });
class ApiError extends Error {
  constructor(errors) { super('Rejected'); this.errors = errors; }
}
function harness({ action = 'no_show', eligible = true, error, pending } = {}) {
  let confirmation = false;
  const state = { values: { reason: '  No collection  ' }, formState: { errors: {}, isSubmitting: false } };
  const calls = [], toasts = [], saved = [];
  let closed = 0;
  const booking = { backendId: 42, bookingCode: 'BK-00042', canRecordNoShow: eligible };
  const jsx = (type, props) => ({ type, props });
  const send = async (...args) => { calls.push(args); if (pending) await pending; if (error) throw error; return { statusKey: action === 'no_show' ? 'no_show' : 'rejected' }; };
  const loadedDialog = load('./BookingDecisionDialog.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    react: { useState: () => [confirmation, (next) => { confirmation = next; }] },
    'react-hook-form': { useForm: () => ({ ...state, register: () => ({}),
      setError: (field, value) => { state.formState.errors[field] = value; },
      handleSubmit: (fn, invalid) => async () => {
        const parsed = schemas.bookingDecisionSchema.safeParse(state.values);
        if (!parsed.success) { invalid?.(); return; }
        state.formState.isSubmitting = true;
        try { return await fn(parsed.data); } finally { state.formState.isSubmitting = false; }
      },
    }) },
    '@hookform/resolvers/zod': { zodResolver: () => ({}) },
    'lucide-react': { XCircle: 'Icon' },
    '@/components/ui/dialog': { Dialog: 'Dialog' },
    '@/components/ui/button': { Button: 'Button' },
    '@/components/common/forms/FormDialogLayout': { FormDialogContent: 'Content', FormDialogHeader: 'Header' },
    '@/components/common/forms/TextAreaWithLabel': { TextAreaWithLabel: 'TextArea' },
    '@/modules/management/bookings/components/BookingDialogFooter': { BookingDialogFooter: 'Footer' },
    './NoShowConfirmation': { NoShowConfirmation: 'NoShowConfirmation' },
    '@/services/booking': { recordBookingNoShow: send, rejectBooking: send },
    '@/services/http': { ApiError },
    '@/lib/toast': { appToast: { success: (message) => toasts.push(['success', message]), error: (message) => toasts.push(['error', message]) } },
    '@/validations/booking/decision': schemas,
  });
  const render = () => {
    const nodes = [];
    function visit(node) { if (!node || typeof node !== 'object') return; nodes.push(node); for (const child of [node.props?.children].flat(Infinity)) visit(child); }
    visit(loadedDialog.BookingDecisionDialog({ booking, action, onClose: () => closed++, onSaved: (value) => saved.push(value) }));
    return {
      submit: () => nodes.find((n) => n.type === 'form').props.onSubmit(),
      confirmation: nodes.find((n) => n.type === 'NoShowConfirmation').props,
      submitButton: nodes.find((n) => n.type === 'Button' && n.props.type === 'submit').props,
      close: () => nodes.find((n) => n.type === 'Header').props.onClose(),
    };
  };
  return { render, calls, toasts, saved, state, closed: () => closed };
}
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

test('a valid reason opens the second dialog without submitting a no-show', async () => {
  const h = harness();
  await h.render().submit();
  assert.equal(h.calls.length, 0);
  assert.equal(h.render().confirmation.open, true);
  h.render().confirmation.onBack();
  assert.equal(h.render().confirmation.open, false);
  assert.equal(h.calls.length, 0);
  assert.equal(h.toasts.length, 0);
});

test('only the second confirmation sends the accepted flag and applies the server result', async () => {
  const h = harness();
  await h.render().submit();
  h.render().confirmation.onConfirm();
  await flush();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][1], 'No collection');
  assert.equal(h.calls[0][2], true);
  assert.equal(h.saved[0].statusKey, 'no_show');
  assert.equal(h.toasts.filter(([kind]) => kind === 'success').length, 1);
});

test('invalid reasons show feedback and never open confirmation or submit', async () => {
  const h = harness();
  h.state.values.reason = ' ';
  await h.render().submit();
  assert.equal(h.render().confirmation.open, false);
  assert.equal(h.calls.length, 0);
  assert.equal(h.toasts[0][0], 'error');
});

test('rejection uses its own action without the no-show confirmation', async () => {
  const h = harness({ action: 'reject' });
  await h.render().submit();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].length, 2);
  assert.equal(h.saved[0].statusKey, 'rejected');
  assert.equal(h.render().confirmation.open, false);
});

test('no-show remains disabled before the server eligibility boundary', () => {
  const h = harness({ eligible: false });
  assert.equal(h.render().submitButton.disabled, true);
  assert.equal(h.calls.length, 0);
});

test('server validation and network failures retain the form and never report success', async () => {
  for (const error of [new ApiError({ reason: ['Enter findings.'] }), new ApiError({ booking: ['Booking already started.'] }), new Error('Network failure')]) {
    const h = harness({ error });
    await h.render().submit();
    h.render().confirmation.onConfirm();
    await flush();
    assert.equal(h.saved.length, 0);
    assert.equal(h.render().confirmation.open, false);
    assert.equal(h.toasts.length, 1);
    assert.equal(h.toasts[0][0], 'error');
    assert.ok(h.state.formState.errors.root.message);
  }
});

test('pending confirmation disables actions and blocks closing', async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const h = harness({ pending });
  await h.render().submit();
  h.render().confirmation.onConfirm();
  await flush();
  assert.equal(h.render().confirmation.busy, true);
  assert.equal(h.render().submitButton.disabled, true);
  h.render().close();
  assert.equal(h.closed(), 0);
  finish();
  await flush();
});

test('reason and explicit no-show acknowledgement match the server request', () => {
  assert.equal(schemas.noShowSchema.safeParse({ reason: 'Checked', confirmed: true }).success, true);
  for (const value of [false, undefined, null]) assert.equal(schemas.noShowSchema.safeParse({ reason: 'Checked', confirmed: value }).success, false);
  for (const reason of ['', ' ', 'a'.repeat(1001), '🚗'.repeat(1001)]) assert.equal(schemas.bookingDecisionSchema.safeParse({ reason }).success, false);
  assert.equal(schemas.bookingDecisionSchema.safeParse({ reason: '🚗'.repeat(1000) }).success, true);
});

test('the second dialog discloses retained payments and remains open during confirmation', () => {
  const jsx = (type, props) => ({ type, props });
  const names = ['AlertDialog', 'AlertDialogAction', 'AlertDialogCancel', 'AlertDialogContent', 'AlertDialogDescription', 'AlertDialogFooter', 'AlertDialogHeader', 'AlertDialogTitle'];
  const { NoShowConfirmation } = load('./NoShowConfirmation.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@/components/ui/alert-dialog': Object.fromEntries(names.map((name) => [name, name])),
  });
  let confirms = 0, backs = 0;
  const render = (busy) => {
    const tree = NoShowConfirmation({ bookingCode: 'BK-00042', open: true, busy, onBack: () => backs++, onConfirm: () => confirms++ });
    const nodes = [];
    const visit = (node) => { if (!node || typeof node !== 'object') return; nodes.push(node); for (const child of [node.props?.children].flat(Infinity)) visit(child); };
    visit(tree);
    return { tree, action: nodes.find((n) => n.type === 'AlertDialogAction'), description: nodes.find((n) => n.type === 'AlertDialogDescription') };
  };
  const ready = render(false);
  assert.match(ready.description.props.children.join(''), /All rental payments are retained; no refund is available/);
  assert.equal(confirms, 0);
  let prevented = false;
  ready.action.props.onClick({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(confirms, 1);
  const pending = render(true);
  assert.equal(pending.action.props.disabled, true);
  pending.tree.props.onOpenChange(false);
  assert.equal(backs, 0);
  ready.tree.props.onOpenChange(false);
  assert.equal(backs, 1);
});
