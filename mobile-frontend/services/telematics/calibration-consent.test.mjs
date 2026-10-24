import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function consentHarness(storage = new Map(), fails = false, version = 2) {
  const source = readFileSync(new URL('./calibration-consent.ts', import.meta.url), 'utf8')
    .replace('CALIBRATION_DISCLOSURE_VERSION = 2', `CALIBRATION_DISCLOSURE_VERSION = ${version}`);
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const get = (key) => { if (fails) throw Error('Unavailable'); return storage.get(key) ?? null; };
  const set = (key, value) => { if (fails) throw Error('Unavailable'); storage.set(key, value); };
  vm.runInNewContext(compiled, { exports, require(name) {
    if (name === 'expo-secure-store') return { getItemAsync: async (key) => get(key), setItemAsync: async (key, value) => set(key, value) };
    throw Error(name);
  } });
  return exports;
}
const scope = { userId: 1, bookingCode: 'TEST-RENTAL', profileId: 'standard' };

test(`Android: explicit disclosure agreement survives reopening and runtime restart`, async () => {
  const storage = new Map();
  const first = consentHarness(storage, false);
  assert.equal(await first.hasCalibrationConsent(scope), false);
  await first.rememberCalibrationConsent(scope);
  assert.equal(await first.hasCalibrationConsent(scope), true);
  const reopened = consentHarness(storage, false);
  assert.equal(await reopened.hasCalibrationConsent(scope), true);
  assert.equal(await consentHarness(storage, false, 3).hasCalibrationConsent(scope), false);
  for (const changed of [{ userId: 2 }, { bookingCode: 'ANOTHER-RENTAL' }, { profileId: 'rc_demo' }]) {
    assert.equal(await reopened.hasCalibrationConsent({ ...scope, ...changed }), false);
  }
  assert.equal([...storage.keys()].every((key) => /^[a-zA-Z0-9._-]+$/.test(key)), true);
});

test('unavailable or corrupt storage never invents agreement', async () => {
  const storage = new Map();
  const first = consentHarness(storage, true);
  assert.equal(await first.hasCalibrationConsent(scope), false);
  await first.rememberCalibrationConsent(scope);
  assert.equal(await first.hasCalibrationConsent(scope), true);
  assert.equal(await consentHarness(storage, true).hasCalibrationConsent(scope), false);
  const saved = consentHarness(storage);
  await saved.rememberCalibrationConsent(scope);
  for (const key of storage.keys()) storage.set(key, 'invalid');
  assert.equal(await consentHarness(storage).hasCalibrationConsent(scope), false);
});
