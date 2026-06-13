import { Stack } from 'expo-router';

import { AuthenticatedOnly } from '@/components/auth/AuthenticatedOnly';

export default function ProfileStackLayout() {
  return (
    <AuthenticatedOnly>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthenticatedOnly>
  );
}
