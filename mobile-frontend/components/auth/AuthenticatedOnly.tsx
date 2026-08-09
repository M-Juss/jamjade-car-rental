import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';

export function AuthenticatedOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#346EF6" size="large" />
      </View>
    );
  }

  if (status === 'guest') {
    return <Redirect href="/login" />;
  }

  return children;
}
