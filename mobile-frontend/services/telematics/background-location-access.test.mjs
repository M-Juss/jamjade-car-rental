import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function native(platform = 'android', options = {}) {
  const calls = [];
  const state = {
    environment: 'bare', services: true, foreground: false, foregroundCanAsk: true,
    background: false, backgroundCanAsk: true, foregroundAnswer: true, backgroundAnswer: true,
    available: true, taskManager: true, taskDefined: true, ...options,
  };
  const location = {
    hasServicesEnabledAsync: async () => { calls.push('services'); return state.services; },
    getForegroundPermissionsAsync: async () => { calls.push('read-foreground'); return { granted: state.foreground, canAskAgain: state.foregroundCanAsk }; },
    requestForegroundPermissionsAsync: async () => { calls.push('request-foreground'); state.foreground = state.foregroundAnswer; },
  };
  const background = {
    getBackgroundLocationReadiness: async () => {
      calls.push('read-background');
      return { permissionState: state.background ? 'granted' : 'denied', canAskAgain: state.backgroundCanAsk,
        backgroundLocationAvailable: state.available, taskManagerAvailable: state.taskManager, taskDefined: state.taskDefined };
    },
    requestBackgroundLocationAccess: async () => { calls.push('request-background'); state.background = state.backgroundAnswer; },
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('./background-location-access.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(source, { exports, require(name) {
    if (name === 'react-native') return { Platform: { OS: platform } };
    if (name === 'expo-constants') return { default: { executionEnvironment: state.environment }, ExecutionEnvironment: { StoreClient: 'storeClient' } };
    if (name === 'expo-location') return location;
    if (name === './background-location') return background;
    throw new Error(`Unexpected native dependency ${name}`);
  } });
  return { ...exports, calls, state };
}

for (const platform of ['android', 'ios']) {
  test(`${platform}: checking access is read-only and granted permissions do not prompt again`, async () => {
    const api = native(platform, { foreground: true, background: true });
    assert.equal((await api.readRentalBackgroundAccess()).status, 'ready');
    assert.equal((await api.prepareRentalBackgroundAccess(() => true)).status, 'ready');
    assert.equal(api.calls.some(call => call.startsWith('request')), false);
  });
  test(`${platform}: explicit preparation requests foreground before background without collecting GPS`, async () => {
    const api = native(platform);
    assert.equal((await api.prepareRentalBackgroundAccess(() => true)).status, 'ready');
    assert.deepEqual(api.calls.filter(call => call.startsWith('request')), ['request-foreground', 'request-background']);
  });
  test(`${platform}: declining foreground prevents a background request`, async () => {
    const api = native(platform, { foregroundAnswer: false });
    assert.equal((await api.prepareRentalBackgroundAccess(() => true)).status, 'foreground_required');
    assert.equal(api.calls.includes('request-background'), false);
  });
  test(`${platform}: permanently denied background permission requires Settings without another prompt`, async () => {
    const api = native(platform, { foreground: true, backgroundCanAsk: false });
    const result = await api.prepareRentalBackgroundAccess(() => true);
    assert.equal(result.status, 'background_required');
    assert.equal(result.canAskAgain, false);
    assert.equal(api.calls.includes('request-background'), false);
  });
  test(`${platform}: temporary foreground access or background denial is not reported as ready`, async () => {
    const api = native(platform, { foreground: true, backgroundAnswer: false });
    assert.equal((await api.prepareRentalBackgroundAccess(() => true)).status, 'background_required');
    assert.equal(api.calls.filter(call => call === 'request-background').length, 1);
  });
}

test('unsupported platforms and Expo Go never invoke permission APIs', async () => {
  for (const api of [native('web'), native('android', { environment: 'storeClient' }), native('ios', { environment: 'storeClient' })]) {
    assert.equal((await api.prepareRentalBackgroundAccess(() => true)).status, 'unavailable');
    assert.deepEqual(api.calls, []);
  }
});

test('disabled services and unavailable native tasks cannot request access', async () => {
  for (const options of [{ services: false }, { available: false }, { taskManager: false }, { taskDefined: false }]) {
    const api = native('android', options);
    const result = await api.prepareRentalBackgroundAccess(() => true);
    assert.equal(result.status, options.services === false ? 'services_disabled' : 'unavailable');
    assert.equal(api.calls.some(call => call.startsWith('request')), false);
  }
});

test('cancellation before or during preparation prevents the next system prompt', async () => {
  const cancelled = native();
  assert.equal(await cancelled.prepareRentalBackgroundAccess(() => false), null);
  assert.deepEqual(cancelled.calls, []);
  const api = native();
  assert.equal(await api.prepareRentalBackgroundAccess(() => !api.calls.includes('request-foreground')), null);
  assert.equal(api.calls.includes('request-background'), false);
});
