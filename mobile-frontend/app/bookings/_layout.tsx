import { Stack } from 'expo-router';

import { AuthenticatedOnly } from '@/components/auth/AuthenticatedOnly';

export default function BookingsStackLayout() {
  return (
    <AuthenticatedOnly>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthenticatedOnly>
  );
}
