import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
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

const { createBasicInfoSchema, createEmergencyContactSchema } = loadModule('./schemas.ts', {
  '@/validation/shared': loadModule('../shared.ts'),
  '@/utils/calculateAge': loadModule('../../utils/calculateAge.ts'),
  '@/lib/customer/driver-license': loadModule('../../lib/customer/driver-license.ts'),
});

const contact = { name: 'Emergency Person', relationship: 'Friend', contactNumber: '09170000001' };
const basicInfo = {
  firstName: 'Test',
  lastName: 'Customer',
  contactNumber: '09170000001',
  birthdate: '2000-01-01',
  address: 'Test address',
  addressDetails: {
    countryCode: 'PH',
    regionCode: '1300000000',
    provinceCode: null,
    cityMunicipalityCode: '100',
    barangayCode: '101',
    addressLine: 'Test street',
    postalCode: '1000',
    formattedAddress: 'Test address',
  },
  profilePicture: '',
};

test('emergency contact rejects the customer number and reports the phone field', () => {
  for (const customerPhone of ['09170000001', '0917 000-0001']) {
    const result = createEmergencyContactSchema(customerPhone).safeParse(contact);
    assert.equal(result.success, false);
    assert.equal(result.error.issues[0].path.join('.'), 'contactNumber');
    assert.equal(result.error.issues[0].message, 'Emergency contact number must be different from your phone number.');
  }
});

test('emergency contact accepts a distinct number or a missing customer number', () => {
  for (const customerPhone of ['09170000002', '']) {
    assert.equal(createEmergencyContactSchema(customerPhone).safeParse(contact).success, true);
  }
});

test('basic information rejects the saved emergency number with a phone field error', () => {
  for (const emergencyPhone of ['09170000001', '0917 000-0001']) {
    const result = createBasicInfoSchema(emergencyPhone).safeParse(basicInfo);
    assert.equal(result.success, false);
    assert.equal(result.error.issues[0].path.join('.'), 'contactNumber');
    assert.equal(result.error.issues[0].message, 'Your phone number must be different from your emergency contact number.');
  }
});

test('basic information accepts a distinct number or a missing emergency contact', () => {
  for (const emergencyPhone of ['09170000002', '']) {
    assert.equal(createBasicInfoSchema(emergencyPhone).safeParse(basicInfo).success, true);
  }
});

test('both schemas preserve required and Philippine mobile number validation', () => {
  for (const value of ['', '0917000000', '091700000012', '08170000001']) {
    assert.equal(createBasicInfoSchema('').safeParse({ ...basicInfo, contactNumber: value }).success, false);
    assert.equal(createEmergencyContactSchema('').safeParse({ ...contact, contactNumber: value }).success, false);
  }
});
