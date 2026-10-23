import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function consentHarness(storage = new Map(), fails = false, platform = 'android') {
  const source = readFileSync(new URL('./location-sharing-consent.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const get = (key) => { if (fails) throw Error('Unavailable'); return storage.get(key) ?? null; };
  const set = (key, value) => { if (fails) throw Error('Unavailable'); storage.set(key, value); };
  vm.runInNewContext(compiled, { exports, window: { localStorage: { getItem: get, setItem: set } }, require(name) {
    if (name === 'expo-secure-store') return { getItemAsync: async (key) => get(key), setItemAsync: async (key, value) => set(key, value) };
    if (name === 'react-native') return { Platform: { OS: platform } };
    if (name === '@/validation/telematics/location-monitoring') return {};
    throw Error(name);
  } });
  return exports;
}

const scope = { userId: 7, bookingCode: 'RENTAL-2026-0042' };
const choice = { consent: true, consent_version: 2, sharing_mode: 'foreground_background' };

for (const platform of ['android', 'ios', 'web']) test(`${platform}: accepted sharing choice is remembered for its account and terms`, async () => {
  const storage = new Map();
  const first = consentHarness(storage, false, platform);
  assert.equal(await first.getLocationSharingConsent(scope, 2), null);
  await first.rememberLocationSharingConsent(scope, choice);
  const reopened = consentHarness(storage, false, platform);
  assert.equal(JSON.stringify(await reopened.getLocationSharingConsent(scope, 2)), JSON.stringify(choice));
  assert.equal(await reopened.getLocationSharingConsent(scope, 3), null);
  const updated = { ...choice, consent_version: 3 };
  await reopened.rememberLocationSharingConsent(scope, updated);
  assert.equal(JSON.stringify(await consentHarness(storage, false, platform).getLocationSharingConsent(scope, 3)), JSON.stringify(updated));
  assert.equal(await reopened.getLocationSharingConsent({ ...scope, userId: 8 }, 2), null);
  assert.equal(JSON.stringify(await reopened.getLocationSharingConsent({ ...scope, bookingCode: 'OTHER' }, 2)), JSON.stringify(choice));
});

for (const platform of ['android', 'ios', 'web']) test(`${platform}: a previously saved booking choice is upgraded to the customer preference`, async () => {
  const storage = new Map();
  const legacyKey = `jamjade.location.consent.${scope.userId}.${encodeURIComponent(scope.bookingCode)}.${choice.consent_version}`;
  storage.set(legacyKey, JSON.stringify({ consent_version: choice.consent_version, sharing_mode: choice.sharing_mode }));
  const current = consentHarness(storage, false, platform);
  const consent = await current.getLocationSharingConsent(scope, choice.consent_version);
  assert.equal(JSON.stringify(consent), JSON.stringify(choice));
  assert.equal(storage.has(`jamjade.location.consent.${scope.userId}.${choice.consent_version}`), true);
  assert.equal(JSON.stringify(await current.getLocationSharingConsent({ ...scope, bookingCode: 'NEW-RENTAL' }, choice.consent_version)), JSON.stringify(choice));
});

test('unavailable storage keeps the explicit choice only for the current runtime', async () => {
  const storage = new Map();
  const current = consentHarness(storage, true);
  await current.rememberLocationSharingConsent(scope, choice);
  assert.equal(JSON.stringify(await current.getLocationSharingConsent(scope, 2)), JSON.stringify(choice));
  assert.equal(await consentHarness(storage, true).getLocationSharingConsent(scope, 2), null);
});

test('corrupt stored choice is never reused', async () => {
  const storage = new Map();
  const first = consentHarness(storage);
  await first.rememberLocationSharingConsent(scope, choice);
  for (const key of storage.keys()) storage.set(key, '{"consent_version":2,"sharing_mode":"unknown"}');
  assert.equal(await consentHarness(storage).getLocationSharingConsent(scope, 2), null);
});
