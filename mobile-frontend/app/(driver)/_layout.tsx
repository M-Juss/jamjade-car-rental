import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { FloatingBottomTabBar } from '@/components/navigation/FloatingBottomTabBar';
import { CustomerTabBarVisibilityProvider } from '@/components/navigation/CustomerTabBarVisibilityContext';
import { DRIVER_TABS } from '@/constants/driver-tabs';
import { themeColors } from '@/constants/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function DriverTabLayout() {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={themeColors.primary} size="large" />
      </View>
    );
  }

  if (status === 'guest') {
    return <Redirect href="/login" />;
  }

  if (!user?.roles?.includes('driver')) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <CustomerTabBarVisibilityProvider>
      <Tabs
        initialRouteName="services"
        tabBar={(props) => <FloatingBottomTabBar {...props} tabs={DRIVER_TABS} />}
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
        }}>
        <Tabs.Screen name="notifications" options={{ title: 'Notif' }} />
        <Tabs.Screen name="services" options={{ title: 'Services' }} />
        <Tabs.Screen name="logout" options={{ title: 'Logout' }} />
      </Tabs>
    </CustomerTabBarVisibilityProvider>
  );
}
