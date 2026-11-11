import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the real client with an isolated transport; no network or stored tokens.
function clientWith(fetch, baseUrls = ['https://example.test/api']) {
  const source = readFileSync(new URL('./client.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  class ApiError extends Error {
    constructor(message, status, errors) { super(message); this.status = status; this.errors = errors; }
  }
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, fetch, Headers, FormData, Blob, URLSearchParams, AbortController, setTimeout, clearTimeout,
    require(name) {
      if (name === './auth-token') return { getApiAuthToken: async () => 'synthetic-token' };
      if (name === './errors') return { ApiError, GENERIC_ERROR_MESSAGE: 'Request failed.' };
      if (name === './config') return {
        API_BASE_URL: baseUrls[0],
        API_NETWORK_FALLBACK_TIMEOUT_MS: 100,
        buildApiUrls: (path) => baseUrls.map((baseUrl) => ({ url: `${baseUrl}${path}`, baseUrl })),
      };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports;
}

test('asset mapping can use the backend selected by a successful fallback request', async () => {
  const client = clientWith(async (url) => {
    if (url.startsWith('http://192.168.1.20')) throw new Error('LAN unavailable');
    return new Response(JSON.stringify({ success: true, data: {} }));
  }, ['http://192.168.1.20:8000/api', 'https://backend.example.test/api']);
  assert.equal(client.getActiveApiBaseUrl(), 'http://192.168.1.20:8000/api');
  await client.apiGet('/mobile/profile');
  assert.equal(client.getActiveApiBaseUrl(), 'https://backend.example.test/api');
});

test('JSON requests retain bearer authentication and response envelopes', async () => {
  const client = clientWith(async (url, options) => {
    assert.equal(options.headers.get('Authorization'), 'Bearer synthetic-token');
    assert.equal(options.headers.get('Accept'), 'application/json');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { value: 2 });
    return new Response(JSON.stringify({ success: true, data: { id: 5 } }));
  });
  assert.equal((await client.apiPost('/example', { value: 2 })).data.id, 5);
});

test('slow registration mail responses outlast the short fallback deadline without replaying the POST', async () => {
  let calls = 0;
  const pending = { registrationId: '123e4567-e89b-42d3-a456-426614174000', email: 'slow@example.test' };
  const client = clientWith(async (_url, options) => {
    calls += 1;
    await new Promise((resolve, reject) => {
      const responseTimer = setTimeout(() => {
        options.signal.removeEventListener('abort', abort);
        resolve();
      }, 150);
      const abort = () => {
        clearTimeout(responseTimer);
        reject(new Error('Aborted'));
      };
      options.signal.addEventListener('abort', abort, { once: true });
    });
    return new Response(JSON.stringify({ success: true, data: pending }));
  }, ['https://primary.example.test/api', 'https://fallback.example.test/api']);

  const response = await client.apiPost('/mobile/register', { email: pending.email }, {
    allowNetworkFallback: true,
    responseTimeoutMs: 300,
    skipAuth: true,
  });

  assert.equal(response.data.registrationId, pending.registrationId);
  assert.equal(response.data.email, pending.email);
  assert.equal(calls, 1, 'A successful delayed mail response must not be sent to a second API candidate.');
});

test('an explicit response timeout aborts a registration POST without retrying another API candidate', async () => {
  let calls = 0;
  const client = clientWith(async (_url, options) => {
    calls += 1;
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
    });
  }, ['https://primary.example.test/api', 'https://fallback.example.test/api']);

  await assert.rejects(
    () => client.apiPost('/mobile/register/resend', { registration_id: 'registration-id' }, {
      allowNetworkFallback: true,
      responseTimeoutMs: 20,
      skipAuth: true,
    }),
    (error) => error.status === 408 && error.message === 'The request timed out. Please try again.',
  );
  assert.equal(calls, 1, 'An ambiguous timed-out POST must not be replayed on a second API candidate.');
});

test('the default GET fallback deadline and transport-error failover remain available', async () => {
  let calls = 0;
  const client = clientWith(async (_url, options) => {
    calls += 1;
    if (calls === 1) {
      await new Promise((resolve, reject) => {
        const abort = () => reject(new Error('Aborted'));
        options.signal.addEventListener('abort', abort, { once: true });
      });
    }
    return new Response(JSON.stringify({ success: true, data: { source: 'fallback' } }));
  }, ['https://primary.example.test/api', 'https://fallback.example.test/api']);

  assert.equal((await client.apiGet('/mobile/me')).data.source, 'fallback');
  assert.equal(calls, 2, 'The existing GET fallback timeout should still advance to the second candidate.');
});

test('an explicit-timeout POST can still fail over after an immediate transport error', async () => {
  let calls = 0;
  const client = clientWith(async () => {
    calls += 1;
    if (calls === 1) throw new Error('Unavailable');
    return new Response(JSON.stringify({ success: true, data: { source: 'fallback' } }));
  }, ['https://primary.example.test/api', 'https://fallback.example.test/api']);

  assert.equal((await client.apiPost('/mobile/register', {}, {
    allowNetworkFallback: true,
    responseTimeoutMs: 300,
    skipAuth: true,
  })).data.source, 'fallback');
  assert.equal(calls, 2, 'A clear transport failure remains eligible for fallback.');
});

test('PDF downloads use the authenticated transport without parsing binary as JSON', async () => {
  const client = clientWith(async (url, options) => {
    assert.equal(url, 'https://example.test/api/mobile/receipts/1/download');
    assert.equal(options.headers.get('Authorization'), 'Bearer synthetic-token');
    assert.equal(options.method, 'GET');
    return new Response('%PDF-retained', { headers: { 'Content-Type': 'application/pdf' } });
  });
  assert.equal(new TextDecoder().decode(await client.apiDownload('/mobile/receipts/1/download')), '%PDF-retained');
});

test('authorization, readiness, and validation errors retain their status for both response types', async () => {
  for (const status of [401, 403, 404, 409, 422, 500]) {
    const client = clientWith(async () => new Response(JSON.stringify({ message: 'Safe failure', errors: { receipt: ['Not ready'] } }), { status }));
    for (const call of [() => client.apiGet('/example'), () => client.apiDownload('/example')]) {
      await assert.rejects(call, (error) => error.status === status && error.errors.receipt[0] === 'Not ready');
    }
  }
});

test('a successful HTML or JSON response cannot be saved as a PDF', async () => {
  const client = clientWith(async () => new Response('{}', { headers: { 'Content-Type': 'application/json' } }));
  await assert.rejects(() => client.apiDownload('/example'), (error) => error.status === 502);
});

test('network errors remain retryable failures rather than a successful receipt', async () => {
  const client = clientWith(async () => { throw new Error('Offline'); });
  await assert.rejects(() => client.apiDownload('/example'), (error) => error.status === 0);
});
