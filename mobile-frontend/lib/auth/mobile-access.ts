import type { CustomerOnboardingRoute } from '@/lib/customer/onboarding';
import type { MobileUser } from '@/services/api/types';

export function isResearchAdmin(user: MobileUser | null) {
  return user?.roles?.includes('admin') === true;
}

export function getMobileHome(user: MobileUser | null, onboardingRoute: CustomerOnboardingRoute | null) {
  if (isResearchAdmin(user)) return '/rc-research' as const;
  if (user?.roles?.includes('driver')) return '/(driver)/services' as const;
  return onboardingRoute ?? '/(tabs)';
}
