import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { ApiError, parseRetryAfter } from './errors.ts';

function clientWith(fetch) {
  const exports = {};
  const compiled = ts.transpileModule(readFileSync(new URL('./client.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports, fetch, Headers, FormData, Blob, URLSearchParams,
    document: { cookie: 'XSRF-TOKEN=synthetic-csrf' },
    require(name) {
      if (name === './errors') return { ApiError, parseRetryAfter, GENERIC_ERROR_MESSAGE: 'Request failed.' };
      if (name === './config') return { buildApiUrl: path => `https://example.test${path}` };
      if (name === './owner-verification') return { requestOwnerVerification: () => { throw new Error('Unexpected owner verification'); } };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return exports;
}

test('login keeps the cookie and CSRF flow and returns retry timing without replaying a 429', async () => {
  const calls = [];
  const client = clientWith(async (url, options) => {
    calls.push(url);
    assert.equal(options.credentials, 'include');
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 });
    assert.equal(options.headers.get('X-XSRF-TOKEN'), 'synthetic-csrf');
    return new Response(JSON.stringify({ success: false }), { status: 429, headers: { 'Retry-After': '42' } });
  });
  await assert.rejects(() => client.apiPost('/admin/login', { email: 'example@example.test', password: 'synthetic' }),
    error => error instanceof ApiError && error.status === 429 && error.retryAfter === 42);
  assert.deepEqual(calls, ['https://example.test/sanctum/csrf-cookie', 'https://example.test/admin/login']);
});

test('field validation still maps server errors without a retry cooldown', async () => {
  const client = clientWith(async url => url.endsWith('/sanctum/csrf-cookie')
    ? new Response(null, { status: 204 })
    : new Response(JSON.stringify({ errors: { email: ['Check this email.'] } }), { status: 422 }));
  await assert.rejects(() => client.apiPost('/admin/login', {}),
    error => error.status === 422 && error.errors.email[0] === 'Check this email.' && error.retryAfter === undefined);
});

test('successful responses keep their envelope and a 429 without valid timing remains a 429', async () => {
  const success = clientWith(async () => new Response(JSON.stringify({ success: true, data: { id: 7 } })));
  assert.equal((await success.apiGet('/admin/me')).data.id, 7);
  const throttled = clientWith(async () => new Response('{}', { status: 429, headers: { 'Retry-After': 'invalid' } }));
  await assert.rejects(() => throttled.apiGet('/admin/me'), error => error.status === 429 && error.retryAfter === undefined);
});

test('Retry-After parsing accepts seconds and HTTP dates but ignores malformed values', () => {
  const now = Date.parse('2026-11-18T00:00:00Z');
  assert.equal(parseRetryAfter('42', now), 42);
  assert.equal(parseRetryAfter('Wed, 18 Nov 2026 00:00:42 GMT', now), 42);
  for (const value of [null, '', ' ', 'invalid', '0', '-1']) assert.equal(parseRetryAfter(value, now), undefined);
});
