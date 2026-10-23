import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function native(platform, changes = {}) {
  let callback, options, removes = 0, prompts = 0;
  class LocationMonitoringIssue extends Error {}
  const location = {
    Accuracy: { High: 4 }, hasServicesEnabledAsync: async () => true,
    getForegroundPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
    requestForegroundPermissionsAsync: async () => { prompts++; return { granted: true }; },
    watchPositionAsync: async (values, reading) => { options = values; callback = reading; return { remove: () => { removes++; } }; },
    ...changes,
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('./foreground-location.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(source, { exports, Date, Number, require: (name) => {
    if (name === 'react-native') return { Platform: { OS: platform } };
    if (name === 'expo-location') return location;
    if (name === './location-monitoring-session') return { LocationMonitoringIssue };
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return { ...exports, get prompts() { return prompts; }, get removes() { return removes; }, get options() { return options; }, emit: (value) => callback(value) };
}

for (const platform of ['android', 'ios']) {
  test(`${platform}: existing foreground permission is reused and the removable watcher drops speed/heading`, async () => {
    const api = native(platform);
    await api.prepareForegroundLocation(() => true);
    assert.equal(api.prompts, 0);
    let reading;
    const subscription = await api.watchForegroundLocation(5, (value) => { reading = value; }, () => {});
    api.emit({ timestamp: Date.parse('2026-10-18T04:00:00Z'), coords: { latitude: 14, longitude: 121, accuracy: 5, speed: 99, heading: 50 } });
    assert.deepEqual(Object.keys(reading), ['latitude', 'longitude', 'accuracy', 'captured_at']);
    assert.equal(api.options.timeInterval, 5000);
    subscription.remove();
    assert.equal(api.removes, 1);
  });
}

test('disabled services, denied permission and unsupported platforms cannot start collection', async () => {
  await assert.rejects(native('web').prepareForegroundLocation(() => true), /Android or iOS/);
  await assert.rejects(native('android', { hasServicesEnabledAsync: async () => false }).prepareForegroundLocation(() => true), /Enable location services/);
  const denied = native('ios', { getForegroundPermissionsAsync: async () => ({ granted: false, canAskAgain: false }) });
  await assert.rejects(denied.prepareForegroundLocation(() => true), /Settings/);
  assert.equal(denied.prompts, 0);
});
