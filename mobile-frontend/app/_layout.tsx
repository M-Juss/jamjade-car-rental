import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';

export const unstable_settings = {
  anchor: '(tabs)',
};

const JamJadeNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#F8FAFF',
    border: '#DDE8FF',
    card: '#FFFFFF',
    primary: '#346EF6',
    text: '#17315F',
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={JamJadeNavigationTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="browse" options={{ headerShown: false }} />
        <Stack.Screen name="bookings" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
      </Stack>
      <StatusBar />
    </ThemeProvider>
  );
}
