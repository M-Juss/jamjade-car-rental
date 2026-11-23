import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as zod from 'zod/v3';

const exports = {};
const compiled = ts.transpileModule(readFileSync(new URL('./schemas.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(compiled, { exports, TextEncoder, require(name) {
  if (name === 'zod/v3') return zod;
  throw new Error(`Unexpected import: ${name}`);
} });

test('Staff and Driver create and edit forms require an 11-digit phone number', () => {
  for (const create of [true, false]) {
    const schema = exports.createPersonnelAccountSchema(create);
    for (const role of ['staff', 'driver']) {
      const values = { role, firstName: 'Test', lastName: 'Person', email: 'person@example.test', status: 'active',
        password: create ? 'Password@123' : '', passwordConfirmation: create ? 'Password@123' : '' };
      for (const phoneNumber of ['', ' ', '0917000000', '08170000000']) {
        const parsed = schema.safeParse({ ...values, phoneNumber });
        assert.equal(parsed.success, false);
        assert.ok(parsed.error.issues.some(issue => issue.path[0] === 'phoneNumber'));
      }
      assert.equal(schema.safeParse({ ...values, phoneNumber: '09170000884' }).success, true);
    }
  }
});
