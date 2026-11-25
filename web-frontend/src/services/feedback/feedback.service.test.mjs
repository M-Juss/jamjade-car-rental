import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as zod from 'zod/v3';

function load(path, imports = {}) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, URLSearchParams, require(name) {
    if (name === '@/lib/table-pagination') return { TABLE_PAGE_SIZE: 10 };
    if (name in imports) return imports[name];
    throw new Error(`Unexpected import: ${name}`);
  } });
  return exports;
}

const validation = load('../../validations/feedback/schemas.ts', { 'zod/v3': zod });

test('lifetime customer reviews ignore report filters and public reviews use the public API namespace', async () => {
  const paths = [];
  const { getCustomerFeedback, getPublicFeedback } = load('./feedback.service.ts', {
    '@/validations/feedback/schemas': validation,
    '@/services/http': { apiGet: async path => {
      paths.push(path);
      return { data: [{ id: 8, rating: 4 }], meta: { total: 21, last_page: 3, average_rating: 4.2 } };
    } },
  });
  const result = await getCustomerFeedback(7, 2);
  assert.equal(paths[0], '/admin/reports/customers/7/feedback?page=2&per_page=10');
  assert.equal(result.average, 4.2);
  assert.equal(result.total, 21);
  assert.equal(result.lastPage, 3);
  await getPublicFeedback(2);
  assert.equal(paths[1], '/api/testimonials?page=2&per_page=20');
});

test('curation submits only an explicit star decision and propagates failed writes', async () => {
  const calls = [];
  const failure = new Error('403');
  const { featureFeedback } = load('./feedback.service.ts', {
    '@/validations/feedback/schemas': validation,
    '@/services/http': { apiPut: async (path, body) => { calls.push({ path, body }); if (calls.length === 2) throw failure; return { data: { id: 8, isFeatured: body.is_featured } }; } },
  });
  assert.equal((await featureFeedback(8, { is_featured: true, rating: 5 })).isFeatured, true);
  assert.equal(calls[0].path, '/admin/feedback/8/featured');
  assert.equal(JSON.stringify(calls[0].body), '{"is_featured":true}');
  await assert.rejects(featureFeedback(8, { is_featured: false }), error => error === failure);
  await assert.rejects(featureFeedback(8, { is_featured: 'invalid' }));
  assert.equal(calls.length, 2);
});
