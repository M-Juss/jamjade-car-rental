import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function serviceWith(filename, http, platform = 'android') {
  const source = readFileSync(new URL(filename, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (name) => {
    if (name === 'react-native') return { Platform: { OS: platform } };
    if (name === '@/services/http') return http;
    throw new Error(`Unexpected import: ${name}`);
  } });
  return exports;
}

test('Admin uses the regular login endpoint and existing secure token abstraction on both platforms', async () => {
  for (const platform of ['android', 'ios']) {
    let saved = false;
    const api = serviceWith('./auth.service.ts', {
      apiPost: async (path, payload, options) => {
        assert.equal(path, '/mobile/login');
        assert.equal(payload.email, 'admin@example.test');
        assert.equal(payload.password, 'synthetic-test-value');
        assert.equal(payload.device_name, `jamjade-${platform}`);
        assert.equal(options.skipAuth, true);
        assert.equal(saved, false);
        return { data: { token: 'synthetic-token', user: { roles: ['admin'] } } };
      },
      persistApiAuthToken: async (token) => { assert.equal(token, 'synthetic-token'); saved = true; },
    }, platform);
    const session = await api.login({ email: 'admin@example.test', password: 'synthetic-test-value' });
    assert.equal(session.user.roles[0], 'admin');
    assert.equal(saved, true);
  }
});

test('a failed login never persists a session', async () => {
  const failure = new Error('denied');
  const api = serviceWith('./auth.service.ts', {
    apiPost: async () => { throw failure; },
    persistApiAuthToken: () => { assert.fail('Failed login must not save a token'); },
  });
  await assert.rejects(() => api.login({ email: 'admin@example.test', password: 'synthetic-test-value' }), failure);
});

test('the empty research page checks access through the authenticated transport', async () => {
  const api = serviceWith('./rc-research.service.ts', { apiGet: async (path, options) => {
    assert.equal(path, '/mobile/rc-research');
    assert.equal(options, undefined);
    return { data: null };
  } });
  assert.equal(await api.checkRcResearchAccess(), undefined);
});
