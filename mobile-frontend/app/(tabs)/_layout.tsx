import { Tabs } from 'expo-router';

import { CustomerBottomTabBar } from '@/components/navigation/CustomerBottomTabBar';
import { CustomerTabBarVisibilityProvider } from '@/components/navigation/CustomerTabBarVisibilityContext';
import { CUSTOMER_TABS } from '@/constants/customer-tabs';
import { AuthenticatedOnly } from '@/components/auth/AuthenticatedOnly';

export default function TabLayout() {
  return (
    <AuthenticatedOnly>
      <CustomerTabBarVisibilityProvider>
        <Tabs
          initialRouteName="index"
          tabBar={(props) => <CustomerBottomTabBar {...props} tabs={CUSTOMER_TABS} />}
          screenOptions={{
            headerShown: false,
            tabBarHideOnKeyboard: true,
          }}>
          <Tabs.Screen
            name="index"
            options={{
              title: 'Browse',
            }}
          />
          <Tabs.Screen
            name="bookings"
            options={{
              title: 'Booking',
            }}
          />
          <Tabs.Screen
            name="telematics"
            options={{
              title: 'Telematics',
            }}
          />
          <Tabs.Screen
            name="notifications"
            options={{
              title: 'Notif',
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: 'Profile',
            }}
          />
        </Tabs>
      </CustomerTabBarVisibilityProvider>
    </AuthenticatedOnly>
  );
}
