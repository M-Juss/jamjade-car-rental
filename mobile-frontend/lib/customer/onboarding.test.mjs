import assert from 'node:assert/strict';
import test from 'node:test';

import { canAccessOnboardingScreen, getCustomerOnboardingRoute } from './onboarding.ts';

// Synthetic account data only. These checks need no backend, token, or device.
const basicProfile = {
  firstName: 'Test',
  lastName: 'Customer',
  phoneNumber: '09123456789',
  birthdate: '2000-01-01',
  address: 'Test address',
};
const contact = { id: 1, name: 'Test Contact', phone_number: '09123456780', relationship: 'Friend' };
const userWith = (profile = basicProfile) => ({
  id: 1,
  name: 'Test Customer',
  email: 'setup@example.test',
  roles: ['customer'],
  profile,
});

test('a newly registered customer resumes basic information', () => {
  assert.equal(getCustomerOnboardingRoute(userWith(null), []), '/onboarding/basic-info');
});

test('every required basic field is checked before later steps', () => {
  for (const field of ['firstName', 'lastName', 'phoneNumber', 'birthdate', 'address']) {
    assert.equal(
      getCustomerOnboardingRoute(userWith({
        ...basicProfile,
        [field]: '',
        profileCompletedAt: '2026-01-01T00:00:00Z',
        drivingIntent: 'owner_driver',
      }), []),
      '/onboarding/basic-info',
      field,
    );
  }
  assert.equal(getCustomerOnboardingRoute(userWith({ ...basicProfile, firstName: '  ' }), []), '/onboarding/basic-info');
});

test('the user-level phone number is accepted', () => {
  const user = { ...userWith({ ...basicProfile, phoneNumber: null }), phoneNumber: '09123456789' };
  assert.equal(getCustomerOnboardingRoute(user, []), '/onboarding/emergency-contact');
});

test('basic information alone does not unlock the customer screens', () => {
  assert.equal(getCustomerOnboardingRoute(userWith(), []), '/onboarding/emergency-contact');
});

test('a saved contact or an explicit skip advances to driving preference', () => {
  assert.equal(getCustomerOnboardingRoute(userWith(), [contact]), '/onboarding/driving-intent');
  assert.equal(getCustomerOnboardingRoute(userWith({
    ...basicProfile,
    emergencyContactSkippedAt: '2026-01-01T00:00:00Z',
  }), []), '/onboarding/driving-intent');
});

test('an incomplete contact does not count as a completed step', () => {
  assert.equal(getCustomerOnboardingRoute(userWith(), [{ ...contact, phone_number: '' }]), '/onboarding/emergency-contact');
});

test('driving preference must be submitted through server completion', () => {
  assert.equal(getCustomerOnboardingRoute(userWith({
    ...basicProfile,
    drivingIntent: 'owner_driver',
  }), [contact]), '/onboarding/driving-intent');
});

test('all driving choices unlock a server-completed profile without verified documents', () => {
  for (const drivingIntent of ['self_drive', 'owner_driver', 'not_sure']) {
    assert.equal(getCustomerOnboardingRoute(userWith({
      ...basicProfile,
      drivingIntent,
      profileCompletedAt: '2026-01-01T00:00:00Z',
      canSelfDrive: false,
      verificationStatus: 'documents_required',
    }), []), null);
  }
});

test('a missing driving preference still needs its step on a previously completed account', () => {
  assert.equal(getCustomerOnboardingRoute(userWith({
    ...basicProfile,
    profileCompletedAt: '2026-01-01T00:00:00Z',
  }), []), '/onboarding/driving-intent');
});

test('a failed overview read does not invent emergency contact progress', () => {
  assert.equal(getCustomerOnboardingRoute(userWith()), '/onboarding/resume');
  assert.equal(getCustomerOnboardingRoute(userWith(), [contact]), '/onboarding/driving-intent');
});

test('completed accounts and explicit skips do not need an emergency contact overview', () => {
  assert.equal(getCustomerOnboardingRoute(userWith({
    ...basicProfile,
    drivingIntent: 'not_sure',
    profileCompletedAt: '2026-01-01T00:00:00Z',
  })), null);
  assert.equal(getCustomerOnboardingRoute(userWith({
    ...basicProfile,
    emergencyContactSkippedAt: '2026-01-01T00:00:00Z',
  })), '/onboarding/driving-intent');
});

test('Drivers do not enter customer setup', () => {
  assert.equal(getCustomerOnboardingRoute({ ...userWith(null), roles: ['driver'] }), null);
});

test('later setup screens and account-ready cannot skip unfinished steps', () => {
  assert.equal(canAccessOnboardingScreen('/onboarding/basic-info', 'emergency-contact'), false);
  assert.equal(canAccessOnboardingScreen('/onboarding/basic-info', 'driving-intent'), false);
  assert.equal(canAccessOnboardingScreen('/onboarding/emergency-contact', 'driving-intent'), false);
  for (const route of ['/onboarding/basic-info', '/onboarding/emergency-contact', '/onboarding/driving-intent']) {
    assert.equal(canAccessOnboardingScreen(route, 'account-ready'), false);
  }
});

test('customers can revisit previous steps and completed customers can see account-ready', () => {
  assert.equal(canAccessOnboardingScreen('/onboarding/emergency-contact', 'basic-info'), true);
  assert.equal(canAccessOnboardingScreen('/onboarding/driving-intent', 'emergency-contact'), true);
  assert.equal(canAccessOnboardingScreen('/onboarding/basic-info', 'get-started'), true);
  assert.equal(canAccessOnboardingScreen(null, 'account-ready'), true);
});

test('unknown progress allows only the retry screen', () => {
  assert.equal(canAccessOnboardingScreen('/onboarding/resume', 'resume'), true);
  assert.equal(canAccessOnboardingScreen('/onboarding/resume', 'driving-intent'), false);
  assert.equal(canAccessOnboardingScreen('/onboarding/resume', 'get-started'), false);
});
