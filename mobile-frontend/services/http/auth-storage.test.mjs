import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function storageHarness(saved = new Map(), unavailable = false) {
  let token = null;
  const key = 'jamjade.mobile.auth_token';
  const secure = (action) => { if (unavailable) throw new Error('Secure storage unavailable'); return action(); };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('./auth-storage.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(source, { exports, require(name) {
    if (name === 'expo-secure-store') return {
      setItemAsync: async (name, value) => secure(() => { assert.equal(name, key); saved.set(name, value); }),
      getItemAsync: async (name) => secure(() => { assert.equal(name, key); return saved.get(name) ?? null; }),
      deleteItemAsync: async (name) => secure(() => { assert.equal(name, key); saved.delete(name); }),
    };
    if (name === './auth-token') return { setApiAuthToken: (value) => { token = value; }, clearApiAuthToken: () => { token = null; } };
    throw new Error(`Unexpected storage dependency: ${name}`);
  } });
  return { ...exports, get token() { return token; } };
}

test('Android sessions restore the existing SecureStore key and sign-out removes both token copies', async () => {
  const saved = new Map();
  const first = storageHarness(saved);
  await first.persistApiAuthToken('synthetic-token');
  assert.equal(first.token, 'synthetic-token');
  const restarted = storageHarness(saved);
  assert.equal(await restarted.restoreApiAuthToken(), 'synthetic-token');
  assert.equal(restarted.token, 'synthetic-token');
  await restarted.removeApiAuthToken();
  assert.equal(restarted.token, null);
  assert.equal(saved.size, 0);
  assert.equal(await storageHarness(saved).restoreApiAuthToken(), null);
});

test('unavailable secure persistence retains only this runtime token and sign-out clears it', async () => {
  const api = storageHarness(new Map(), true);
  await api.persistApiAuthToken('synthetic-token');
  assert.equal(api.token, 'synthetic-token');
  await assert.rejects(api.restoreApiAuthToken(), /Secure storage unavailable/);
  await assert.rejects(api.removeApiAuthToken(), /Secure storage unavailable/);
  assert.equal(api.token, null);
});
