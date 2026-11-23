import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync(new URL('./DriverWorkflowForm.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function form(workflow, update = async () => ({ status: 'Confirmed' })) {
  const routes = [];
  const calls = [];
  const saved = [];
  const errors = [];
  let action;
  const pending = [];
  let confirmation;
  class ApiError extends Error {}
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(compiled, { exports, encodeURIComponent, require(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react') return { useRef: value => ({ current: value }), useState: value => [value, value => errors.push(value)] };
    if (name === 'react-native') return { Text: 'Text', View: 'View', Alert: { alert: (_title, _message, buttons) => { confirmation = buttons.at(-1).onPress; } } };
    if (name === 'expo-router') return { useRouter: () => ({ push: route => routes.push(route) }) };
    if (name === '@hookform/resolvers/zod') return { zodResolver: () => undefined };
    if (name === 'react-hook-form') return { useForm: () => ({
      handleSubmit: callback => () => { const request = callback({ action }); pending.push(request); return request; },
      setValue: (_field, value) => { action = value; }, formState: { isSubmitting: false },
    }) };
    if (name === '@/components/bookings/ActionButton') return { ActionButton: 'ActionButton' };
    if (name === '@/services/api/driver-workflow.service') return { updateDriverWorkflow: async (id, payload) => { calls.push({ id, ...payload }); return update(); } };
    if (name === '@/services/http') return { ApiError };
    if (name === '@/validation/booking/driver-workflow') return { driverWorkflowSchema: {} };
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  const tree = exports.DriverWorkflowForm({ bookingId: 42, bookingCode: 'BK/42', workflow, pickupType: 'Delivery', onUpdated: value => saved.push(value) });
  function nodes(node) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    return [node, ...nodes(node.props?.children)];
  }
  const buttons = nodes(tree).filter(node => node.type === 'ActionButton');
  return { routes, calls, saved, errors, buttons, wait: () => Promise.all(pending), confirm: () => confirmation() };
}

test('upcoming departure is disabled until the server allows inspection and pickup progress', () => {
  const current = form({ status: 'assigned', canReportOnWay: false });
  assert.equal(current.buttons[0].props.label, 'On my way to pickup');
  assert.equal(current.buttons[0].props.disabled, true);
  assert.equal(current.buttons.some(button => /Telematics|setup/.test(button.props.label)), false);
});

test('arrival exposes setup using the canonical booking reference, preserving monitoring identity', () => {
  const current = form({ status: 'arrived', canBeginSetup: true });
  current.buttons[0].props.onPress();
  assert.deepEqual(current.routes, ['/driver-telematics/BK%2F42']);
  assert.equal(current.calls.length, 0);
});

test('release needs confirmation and cannot submit twice while the first request is pending', async () => {
  let complete;
  const response = new Promise(resolve => { complete = resolve; });
  const current = form({ status: 'arrived', setupComplete: true, canStartRental: true }, () => response);
  current.buttons[0].props.onPress();
  assert.equal(current.calls.length, 0);
  current.confirm();
  current.confirm();
  assert.equal(current.calls.length, 1);
  assert.equal(current.calls[0].id, 42);
  assert.equal(current.calls[0].action, 'start_rental');
  complete({ status: 'Active' });
  await current.wait();
  assert.equal(current.saved.length, 1);
  assert.equal(current.saved[0].status, 'Active');
});

test('network failure keeps the workflow retryable and does not invoke a saved-state callback', async () => {
  const current = form({ status: 'on_way', canReportArrival: true }, async () => { throw new Error('Synthetic offline failure'); });
  current.buttons[0].props.onPress();
  await current.wait();
  assert.equal(current.saved.length, 0);
  assert.ok(current.errors.some(Boolean));
  current.buttons[0].props.onPress();
  await current.wait();
  assert.equal(current.calls.length, 2);
});
