import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function loadModule(path, imports) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, URL, FormData,
    require(name) {
      if (name in imports) return imports[name];
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports;
}

const photo = 'http://localhost:8000/storage/profiles/example.jpg';
const profile = { firstName: 'Test', profilePicture: photo };
const user = { id: 1, email: 'test@example.test', profile };

function mappingFor(baseUrl) {
  return loadModule('./profile-mapping.ts', {
    '@/services/http': { getActiveApiBaseUrl: () => baseUrl },
  });
}

test('loopback and relative photos use the active LAN or tunnel backend origin', () => {
  for (const origin of ['http://192.168.1.20:8000', 'https://backend.example.test']) {
    const { normalizeProfilePhotoUrl } = mappingFor(`${origin}/api`);
    for (const value of [photo, 'http://127.0.0.1:8000/storage/profiles/example.jpg', 'http://[::1]:8000/storage/profiles/example.jpg', '/storage/profiles/example.jpg', 'storage/profiles/example.jpg']) {
      assert.equal(normalizeProfilePhotoUrl(value), `${origin}/storage/profiles/example.jpg`);
    }
    assert.equal(normalizeProfilePhotoUrl(`${photo}?v=2#preview`), `${origin}/storage/profiles/example.jpg?v=2#preview`);
  }
});

test('external image hosts, local picker URIs, and empty photos are preserved', () => {
  const { normalizeProfilePhotoUrl, mapUserProfile } = mappingFor('https://backend.example.test/api');
  for (const value of ['https://images.example.test/avatar.jpg', 'file:///cache/avatar.jpg', 'content://media/1', 'blob:https://app.example.test/photo', 'data:image/png;base64,example']) {
    assert.equal(normalizeProfilePhotoUrl(value), value);
  }
  for (const value of ['', '  ', undefined, null]) assert.equal(normalizeProfilePhotoUrl(value), '');
  assert.equal(mapUserProfile({ ...user, profile: null }).profile, null);
});

test('profile reads and saves map photos without changing the request contract', async () => {
  const expected = 'https://backend.example.test/storage/profiles/example.jpg';
  const mapping = mappingFor('https://backend.example.test/api');
  let saved;
  const service = loadModule('./profile.service.ts', {
    './profile-mapping': mapping,
    '@/services/http': {
      apiGet: async () => ({ data: { profile, user, documents: [] } }),
      apiPut: async (path, body) => { saved = { path, body }; return { data: profile }; },
      apiPost: async () => ({ data: profile }),
    },
  });
  const overview = await service.getProfile();
  assert.equal(overview.profile.profilePicture, expected);
  assert.equal(overview.user.profile.profilePicture, expected);
  const result = await service.updateProfile({
    firstName: 'Test', lastName: 'Customer', contactNumber: '09123456789',
    birthdate: '2000-01-01', address: 'Test address', profilePicture: expected,
    addressDetails: { countryCode: 'PH', regionCode: '01', provinceCode: null, cityMunicipalityCode: '0101', barangayCode: '010101', addressLine: 'Test address', postalCode: '1000' },
  });
  assert.equal(result.profilePicture, expected);
  assert.equal(saved.path, '/mobile/profile');
  assert.equal(saved.body instanceof FormData, false, 'A saved remote photo must not be uploaded as a local file.');
  assert.equal('profile_picture' in saved.body, false);
  assert.equal((await service.completeProfile({ drivingIntent: 'self_drive' })).profilePicture, expected);
  assert.equal(profile.profilePicture, photo, 'Mapping must not mutate the API record.');
});

test('sign-in, registration verification, restoration and email updates retain the corrected photo', async () => {
  const mapping = mappingFor('https://backend.example.test/api');
  const persistedTokens = [];
  const calls = [];
  const http = {
    apiGet: async () => ({ data: { user } }),
    apiPost: async (path, payload, options) => {
      calls.push({ path, payload, options });
      if (path === '/mobile/register' || path === '/mobile/register/resend') return { data: { registrationId: '123e4567-e89b-42d3-a456-426614174000', email: user.email, expiresAt: '2026-11-11T03:15:00Z', resendAvailableAt: '2026-11-11T03:01:00Z' } };
      return { data: { user, token: 'synthetic-token' } };
    },
    apiPut: async () => ({ data: user }),
    persistApiAuthToken: async (token) => persistedTokens.push(token),
  };
  const auth = loadModule('./auth.service.ts', { './profile-mapping': mapping, '@/services/http': http, 'react-native': { Platform: { OS: 'android' } },
    '@/services/telematics/native-recorder': { nativeRecorder: { lock: async () => {} } },
  });
  const account = loadModule('./account.service.ts', { './profile-mapping': mapping, '@/services/http': http });
  const loginResult = await auth.login({});
  const pending = await auth.beginRegistration({ email: user.email, password: 'password', password_confirmation: 'password' });
  assert.equal(pending.registrationId, '123e4567-e89b-42d3-a456-426614174000');
  assert.equal(calls[1].options.responseTimeoutMs, 60_000);
  assert.equal(calls[0].options.responseTimeoutMs, undefined, 'Sign-in keeps the default transport timeout behavior.');
  assert.deepEqual(persistedTokens, ['synthetic-token'], 'Starting registration must not authenticate or persist a token.');
  const resent = await auth.resendRegistrationCode({ registration_id: pending.registrationId });
  assert.equal(resent.registrationId, pending.registrationId);
  assert.equal(calls[2].options.responseTimeoutMs, 60_000);
  assert.deepEqual(persistedTokens, ['synthetic-token'], 'Resending a code must not authenticate or persist a token.');
  const verified = await auth.verifyRegistration({ registration_id: resent.registrationId, code: '123456' });
  const results = [loginResult.user, verified.user, await auth.getCurrentUser(), await account.updateAccountEmail({})];
  for (const result of results) assert.equal(result.profile.profilePicture, 'https://backend.example.test/storage/profiles/example.jpg');
  assert.deepEqual(calls.slice(0, 4).map(({ path }) => path), ['/mobile/login', '/mobile/register', '/mobile/register/resend', '/mobile/register/verify']);
  assert.deepEqual(calls[2].payload, { registration_id: pending.registrationId });
  assert.deepEqual(calls[3].payload, { registration_id: pending.registrationId, code: '123456' });
  assert.deepEqual(persistedTokens, ['synthetic-token', 'synthetic-token']);
});
