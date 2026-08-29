import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';

import { themeColors } from '@/constants/theme';
import { AuthProvider } from '@/providers/AuthProvider';

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
};

export default function RootLayout() {
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
