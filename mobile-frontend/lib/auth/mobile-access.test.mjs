import assert from 'node:assert/strict';
import test from 'node:test';

import { getMobileHome, isResearchAdmin } from './mobile-access.ts';

const user = (roles) => ({ id: 1, name: 'Test', email: 'test@example.test', roles });

test('Admin goes to research even if customer onboarding or a Driver role exists', () => {
  assert.equal(getMobileHome(user(['admin']), '/onboarding/basic-info'), '/rc-research');
  assert.equal(getMobileHome(user(['admin', 'driver']), null), '/rc-research');
});

test('existing Driver and Customer destinations are preserved', () => {
  assert.equal(getMobileHome(user(['driver']), null), '/(driver)/services');
  assert.equal(getMobileHome(user(['customer']), '/onboarding/basic-info'), '/onboarding/basic-info');
  assert.equal(getMobileHome(user(['customer']), null), '/(tabs)');
});

test('a missing or non-Admin role does not grant research navigation', () => {
  for (const account of [null, user([]), user(['customer']), user(['driver']), user(['staff'])]) {
    assert.equal(isResearchAdmin(account), false);
  }
});
