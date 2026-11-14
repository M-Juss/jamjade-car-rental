import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function loadModule(path, imports = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      if (name === 'zod') return require('zod');
      if (name in imports) return imports[name];
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports;
}

const exports = loadModule('./schemas.ts', {
  '@/validation/shared': loadModule('../shared.ts'),
});

test('registration passwords match the backend bcrypt byte limit', () => {
  const parse = (password) => exports.registerSchema.safeParse({ email: 'new@example.test', password, confirmPassword: password }).success;
  assert.equal(parse(`A!${'a'.repeat(70)}`), true);
  assert.equal(parse(`A!${'é'.repeat(35)}`), true);
  assert.equal(parse(`A!${'😀'.repeat(18)}`), false);
  assert.equal(parse(`A!${'a'.repeat(71)}`), false);
  assert.equal(parse('lowercase!9'), false);
  assert.equal(parse('Uppercase123'), false);
});

test('verification accepts exactly six ASCII digits and a UUID session', () => {
  const registrationId = '123e4567-e89b-42d3-a456-426614174000';
  for (const code of ['123456', '000042']) {
    assert.equal(exports.registrationVerificationSchema.safeParse({ registrationId, code }).success, true);
  }
  for (const code of ['12345', '1234567', '12345\n', '123456\n', '１２３４５６']) {
    assert.equal(exports.registrationVerificationSchema.safeParse({ registrationId, code }).success, false);
  }
  assert.equal(exports.registrationVerificationSchema.safeParse({ registrationId: 'bad-id', code: '123456' }).success, false);
});
