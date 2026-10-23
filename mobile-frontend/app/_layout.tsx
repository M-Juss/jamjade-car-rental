import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';
import '../global.css';
import '@/services/telematics/background-location';

import { fontFamilies, mobileFontAssets } from '@/constants/fonts';
import { themeColors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { isResearchAdmin } from '@/lib/auth/mobile-access';
import { useLocationMonitoringLifecycle } from '@/hooks/telematics/useLocationMonitoring';

void SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: 'index',
};

const JamJadeNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: themeColors.background,
    border: themeColors.border,
    card: themeColors.surface,
    primary: themeColors.primary,
    text: themeColors.foreground,
  },
  fonts: {
    regular: { fontFamily: fontFamilies.regular, fontWeight: 'normal' as const },
    medium: { fontFamily: fontFamilies.medium, fontWeight: 'normal' as const },
    bold: { fontFamily: fontFamilies.bold, fontWeight: 'normal' as const },
    heavy: { fontFamily: fontFamilies.black, fontWeight: 'normal' as const },
  },
};

function RootNavigator() {
  const { status, user, onboardingRoute } = useAuth();
  useLocationMonitoringLifecycle(status === 'authenticated' ? user?.id ?? null : null);
  const researchAdmin = status === 'authenticated' && isResearchAdmin(user);

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={themeColors.primary} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Protected guard={researchAdmin}>
        <Stack.Screen name="rc-research" />
      </Stack.Protected>
      <Stack.Protected guard={!researchAdmin}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(driver)" />
        <Stack.Screen name="driver-payment" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'authenticated' && user?.roles?.includes('driver') === true}>
        <Stack.Screen name="driver-telematics" />
      </Stack.Protected>
      <Stack.Protected guard={!researchAdmin && (status !== 'authenticated' || onboardingRoute === null)}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="vehicles" />
        <Stack.Screen name="browse" />
        <Stack.Screen name="bookings" />
        <Stack.Screen name="telematics" />
        <Stack.Screen name="profile" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(mobileFontAssets);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AuthProvider>
      <ThemeProvider value={JamJadeNavigationTheme}>
        <RootNavigator />
        <StatusBar />
      </ThemeProvider>
    </AuthProvider>
  );
}
