import type { MobileEmergencyContact, MobileUser } from '@/services/api/types';

export type CustomerOnboardingRoute =
  | '/onboarding/basic-info'
  | '/onboarding/emergency-contact'
  | '/onboarding/driving-intent'
  | '/onboarding/resume';

export function getCustomerOnboardingRoute(
  user: MobileUser,
  emergencyContacts?: MobileEmergencyContact[],
): CustomerOnboardingRoute | null {
  if (user.roles?.includes('driver')) {
    return null;
  }

  const profile = user.profile;
  if (!(
    profile?.firstName?.trim() &&
    profile.lastName?.trim() &&
    (user.phoneNumber ?? profile.phoneNumber)?.trim() &&
    profile.birthdate &&
    profile.address?.trim()
  )) {
    return '/onboarding/basic-info';
  }

  // The server's completion marker also covers previously completed accounts.
  if (profile.profileCompletedAt) {
    return profile.drivingIntent ? null : '/onboarding/driving-intent';
  }

  if (!profile.emergencyContactSkippedAt) {
    // A failed overview read must not guess whether a contact was already saved.
    if (!emergencyContacts) {
      return '/onboarding/resume';
    }

    if (!emergencyContacts.some((contact) =>
      contact.name.trim() && contact.phone_number.trim() && contact.relationship.trim(),
    )) {
      return '/onboarding/emergency-contact';
    }
  }

  return '/onboarding/driving-intent';
}

export function canAccessOnboardingScreen(
  requiredRoute: CustomerOnboardingRoute | null,
  screen: string,
) {
  if (!requiredRoute) {
    return true;
  }

  if (requiredRoute === '/onboarding/resume') {
    return screen === 'resume';
  }

  switch (screen) {
    case 'account-ready':
      return false;
    case 'driving-intent':
      return requiredRoute === '/onboarding/driving-intent';
    case 'emergency-contact':
      return requiredRoute !== '/onboarding/basic-info';
    default:
      return true;
  }
}
