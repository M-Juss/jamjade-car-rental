import { Redirect, Stack, useSegments } from 'expo-router';

import { AuthenticatedOnly } from '@/components/auth/AuthenticatedOnly';
import { canAccessOnboardingScreen } from '@/lib/customer/onboarding';
import { useAuth } from '@/providers/AuthProvider';

export default function OnboardingLayout() {
  const { status, user, onboardingRoute } = useAuth();
  const segments = useSegments();
  const screen = segments[segments.length - 1];

  if (status === 'authenticated') {
    if (user?.roles?.includes('driver')) {
      return <Redirect href="/(driver)/services" />;
    }

    if (onboardingRoute && !canAccessOnboardingScreen(onboardingRoute, screen)) {
      return <Redirect href={onboardingRoute} />;
    }
  }

  return (
    <AuthenticatedOnly>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthenticatedOnly>
  );
}
