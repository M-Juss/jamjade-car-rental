import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import '../global.css';
import '@/services/telematics/background-location';

import { fontFamilies, mobileFontAssets } from '@/constants/fonts';
import { themeColors } from '@/constants/theme';
import { AuthProvider } from '@/providers/AuthProvider';

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
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(driver)" options={{ headerShown: false }} />
          <Stack.Screen name="vehicles" options={{ headerShown: false }} />
          <Stack.Screen name="browse" options={{ headerShown: false }} />
          <Stack.Screen name="bookings" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ headerShown: false }} />
          <Stack.Screen name="driver-payment" options={{ headerShown: false }} />
        </Stack>
        <StatusBar />
      </ThemeProvider>
    </AuthProvider>
  );
}
