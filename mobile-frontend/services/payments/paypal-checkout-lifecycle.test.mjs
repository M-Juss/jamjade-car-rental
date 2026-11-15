import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { AbortController } from 'abort-controller';

function harness() {
  const abandoned = [];
  const results = [];
  const exports = {};
  let cleanup;
  const source = ts.transpileModule(readFileSync(new URL('../../hooks/use-paypal-browser.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    exports, AbortController,
    require(name) {
      if (name === 'react') return {
        useRef: (value) => ({ current: value }),
        useEffect: (effect) => { cleanup = effect(); },
        useCallback: (callback) => callback,
      };
      if (name === '@/services/api/payment.service') return {
        abandonPayPalOrder: async (id) => { abandoned.push(id); },
      };
      if (name === '@/services/payments/paypal-browser') return {
        openPayPalBrowser: async () => {
          const next = results.shift();
          if (next instanceof Error) throw next;
          return typeof next === 'function' ? await next() : next;
        },
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  const open = exports.usePayPalBrowser();
  return { abandoned, results, open: () => open({ orderId: 'ORDER-1' }), exit: () => cleanup() };
}

test('a paused checkout remains available for retry, then releases the uncaptured order on screen exit', async () => {
  const h = harness();
  h.results.push('interrupted', 'interrupted');
  assert.equal(await h.open(), 'interrupted');
  assert.deepEqual(h.abandoned, []);
  assert.equal(await h.open(), 'interrupted');
  assert.deepEqual(h.abandoned, []);
  h.exit();
  assert.deepEqual(h.abandoned, ['ORDER-1']);
});

test('a browser launch failure can retry the same order and never abandons its approved capture', async () => {
  const h = harness();
  h.results.push(new Error('Launch failed'), 'approved');
  await assert.rejects(h.open(), /Launch failed/);
  assert.deepEqual(h.abandoned, []);
  assert.equal(await h.open(), 'approved');
  h.exit();
  assert.deepEqual(h.abandoned, []);
});

test('a created order arriving after the payment screen closes is released without opening checkout', async () => {
  const h = harness();
  h.exit();
  assert.equal(await h.open(), 'exited');
  assert.deepEqual(h.abandoned, ['ORDER-1']);
});

test('leaving while the browser is pending cannot start a capture on the closed screen', async () => {
  const h = harness();
  let resolve;
  h.results.push(() => new Promise((done) => { resolve = done; }));
  const pending = h.open();
  h.exit();
  resolve('interrupted');
  assert.equal(await pending, 'exited');
  assert.deepEqual(h.abandoned, ['ORDER-1']);
});
