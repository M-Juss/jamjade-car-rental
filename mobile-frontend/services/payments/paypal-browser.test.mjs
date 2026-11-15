import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { AbortController } from 'abort-controller';

function harness({ browsers = ['com.android.chrome'], prefix = 'mobilefrontend://paypal/' } = {}) {
  const urls = new Set();
  const states = new Set();
  const timers = new Map();
  const launches = [];
  const failures = [];
  let browserLookupFailure;
  let timerId = 0;
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('./paypal-browser.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const subscribe = (set, callback) => {
    set.add(callback);
    return { remove: () => set.delete(callback) };
  };
  vm.runInNewContext(source, {
    exports, URL, Promise, Error,
    setTimeout: (callback) => { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout: (id) => timers.delete(id),
    require(name) {
      if (name === 'expo-linking') return { addEventListener: (_, callback) => subscribe(urls, callback) };
      if (name === 'react-native') return { AppState: { addEventListener: (_, callback) => subscribe(states, callback) } };
      if (name === '@/constants/theme') return { themeColors: { surface: '#FFFFFF' } };
      if (name === '@/lib/payments/paypal-callbacks') return {
        createPayPalCallbackUrls: (target) => ({
          returnUrl: `${prefix}${target === 'driver' ? 'driver-' : ''}return`,
          cancelUrl: `${prefix}${target === 'driver' ? 'driver-' : ''}cancel`,
        }),
      };
      if (name === 'expo-web-browser') return {
        getCustomTabsSupportingBrowsersAsync: async () => {
          if (browserLookupFailure) throw browserLookupFailure;
          return { browserPackages: browsers, preferredBrowserPackage: browsers[0] };
        },
        openBrowserAsync: async (url, options) => {
          launches.push({ url, options });
          const failure = failures.shift();
          if (failure instanceof Error) throw failure;
          return failure ?? { type: 'opened' };
        },
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return {
    failures, launches,
    failLookup(error) { browserLookupFailure = error; },
    open(id = 'ORDER-1', target = 'customer', signal = new AbortController().signal) {
      return exports.openPayPalBrowser({ orderId: id, approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow' }, target, signal);
    },
    url(url) { for (const callback of [...urls]) callback({ url }); },
    state(state) { for (const callback of [...states]) callback(state); },
    timers() { for (const callback of [...timers.values()]) callback(); },
    subscriptions() { return { urls: urls.size, states: states.size, timers: timers.size }; },
  };
}

const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const clean = (h) => assert.deepEqual(h.subscriptions(), { urls: 0, states: 0, timers: 0 });

test('a rejected launch releases the session so the next attempt can approve', async () => {
  const h = harness();
  h.failures.push(new Error('Native launch failed'));
  await assert.rejects(h.open(), /checkout could not open/);
  clean(h);
  const retry = h.open();
  await flush();
  h.url('mobilefrontend://paypal/return?token=ORDER-1');
  assert.equal(await retry, 'approved');
  assert.equal(h.launches.length, 2);
  assert.equal(h.launches[1].options.browserPackage, 'com.android.chrome');
  assert.equal(h.launches[1].options.createTask, false);
  clean(h);
});

test('browser-discovery failure and a locked browser also release all listeners', async () => {
  const h = harness();
  h.failLookup(new Error('Discovery failed'));
  await assert.rejects(h.open(), /checkout could not open/);
  clean(h);
  h.failLookup(undefined);
  h.failures.push({ type: 'locked' });
  await assert.rejects(h.open(), /checkout could not open/);
  clean(h);
});

test('returning without approval is an interruption and a new browser attempt remains possible', async () => {
  const h = harness();
  const first = h.open();
  await flush();
  h.state('background');
  h.state('active');
  h.timers();
  assert.equal(await first, 'interrupted');
  clean(h);
  const second = h.open();
  await flush();
  h.url('mobilefrontend://paypal/return?token=ORDER-1');
  assert.equal(await second, 'approved');
  clean(h);
});

test('approval arriving after Android resumes wins over the interruption timer', async () => {
  const h = harness();
  const result = h.open();
  await flush();
  h.state('background');
  h.state('active');
  h.url('mobilefrontend://paypal/return?token=ORDER-1');
  h.timers();
  assert.equal(await result, 'approved');
  clean(h);
});

test('a redundant active event or returning to the browser does not end checkout', async () => {
  const h = harness();
  const result = h.open();
  await flush();
  h.state('active');
  assert.equal(h.subscriptions().timers, 0);
  h.state('background');
  h.state('active');
  h.state('background');
  assert.equal(h.subscriptions().timers, 0);
  h.url('mobilefrontend://paypal/return?token=ORDER-1');
  assert.equal(await result, 'approved');
  clean(h);
});

for (const target of ['customer', 'driver']) {
  test(`${target} checkout accepts only its exact callback and matching order`, async () => {
    const h = harness();
    const result = h.open('NEW', target);
    await flush();
    const path = target === 'driver' ? 'driver-return' : 'return';
    for (const url of [
      `mobilefrontend://paypal/${path}?token=OLD`,
      `mobilefrontend://paypal/${path}?token=NEW&token=OLD`,
      `mobilefrontend://paypal/${path}`,
      `https://unrelated.example/${path}?token=NEW`,
      `mobilefrontend://paypal/${path}/other?token=NEW`,
      'mobilefrontend://paypal/cancel?token=OLD',
      `mobilefrontend://paypal/${target === 'driver' ? 'return' : 'driver-return'}?token=NEW`,
      'malformed',
    ]) h.url(url);
    assert.equal(h.subscriptions().urls, 1);
    h.url(`mobilefrontend://paypal/${path}?token=NEW`);
    assert.equal(await result, 'approved');
    clean(h);
  });

  test(`${target} explicit cancellation is separate from dismissal`, async () => {
    const h = harness();
    const result = h.open('ORDER-1', target);
    await flush();
    h.url(`mobilefrontend://paypal/${target === 'driver' ? 'driver-' : ''}cancel?token=ORDER-1`);
    assert.equal(await result, 'cancelled');
    clean(h);
  });
}

test('Expo Go callbacks and a non-Chrome Custom Tabs provider remain supported', async () => {
  const h = harness({ prefix: 'exp://127.0.0.1:8081/--/paypal/', browsers: ['org.mozilla.firefox'] });
  const result = h.open();
  await flush();
  assert.equal(h.launches[0].options.browserPackage, 'org.mozilla.firefox');
  h.url('exp://127.0.0.1:8081/--/paypal/return?token=ORDER-1');
  assert.equal(await result, 'approved');
  clean(h);
});

test('aborting on screen exit removes listeners and permits a fresh session', async () => {
  const h = harness();
  const controller = new AbortController();
  const result = h.open('OLD', 'customer', controller.signal);
  await flush();
  controller.abort();
  assert.equal(await result, 'interrupted');
  clean(h);
  const next = h.open('NEW');
  await flush();
  h.url('mobilefrontend://paypal/return?token=OLD');
  assert.equal(h.subscriptions().urls, 1);
  h.url('mobilefrontend://paypal/return?token=NEW');
  assert.equal(await next, 'approved');
  clean(h);
});

test('replacing a stale JS session releases the old handler without affecting the new checkout', async () => {
  const h = harness();
  const first = h.open('OLD');
  await flush();
  const second = h.open('NEW');
  await flush();
  assert.equal(await first, 'interrupted');
  h.url('mobilefrontend://paypal/cancel?token=OLD');
  assert.equal(h.subscriptions().urls, 1);
  h.url('mobilefrontend://paypal/return?token=NEW');
  assert.equal(await second, 'approved');
  clean(h);
});

test('an already-aborted screen never launches a browser', async () => {
  const h = harness();
  const controller = new AbortController();
  controller.abort();
  assert.equal(await h.open('ORDER-1', 'customer', controller.signal), 'interrupted');
  assert.equal(h.launches.length, 0);
  clean(h);
});
