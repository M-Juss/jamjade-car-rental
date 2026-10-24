import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function callbacks(environment) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('./paypal-callbacks.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(source, { exports, require(name) {
    if (name === 'expo-constants') return { default: { executionEnvironment: environment }, ExecutionEnvironment: { StoreClient: 'storeClient' } };
    if (name === 'expo-linking') return { createURL: (path) => `exp://127.0.0.1:8081/--${path}` };
    throw new Error(`Unexpected callback dependency: ${name}`);
  } });
  return exports.createPayPalCallbackUrls;
}

for (const target of ['customer', 'driver']) {
  test(`installed Android ${target} checkout matches both return and cancellation without a development host`, () => {
    const urls = callbacks('standalone')(target);
    const prefix = `mobilefrontend://paypal/${target === 'driver' ? 'driver-' : ''}`;
    assert.equal(urls.returnUrl, `${prefix}return`);
    assert.equal(urls.cancelUrl, `${prefix}cancel`);
    assert.equal(urls.sessionReturnUrl, prefix);
  });
  test(`Android Expo Go ${target} checkout retains generated development callbacks`, () => {
    const urls = callbacks('storeClient')(target);
    const prefix = `exp://127.0.0.1:8081/--/paypal/${target === 'driver' ? 'driver-' : ''}`;
    assert.equal(urls.returnUrl, `${prefix}return`);
    assert.equal(urls.cancelUrl, `${prefix}cancel`);
    assert.equal(urls.sessionReturnUrl, prefix);
  });
}
