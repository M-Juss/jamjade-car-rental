import { Redirect, Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Image, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { mobileLayout } from '@/constants/layout';
import { useAuth } from '@/providers/AuthProvider';

const welcomeTextScaleLimit = 1.3;

export default function LandingScreen() {
  const router = useRouter();
  const { status, user } = useAuth();
  const insets = useSafeAreaInsets();
  const { fontScale, height, width } = useWindowDimensions();
  const [artworkSize, setArtworkSize] = useState({ width: 0, height: 0 });
  const availableHeight = height - insets.top - insets.bottom;
  const isLandscape = width > height;
  const textScale = Math.min(fontScale, welcomeTextScaleLimit);
  const isCompact = availableHeight / textScale < 700;
  const contentWidth = width - insets.left - insets.right;
  const headingWidth = contentWidth * (isLandscape ? 0.5 : 1) - mobileLayout.screenPadding * 2;
  const headingSize = Math.min(
    isCompact ? 32 : 42,
    headingWidth * 0.1,
    (availableHeight / textScale) * (isLandscape ? 0.08 : 0.052),
  );
  const frameSpacing = isCompact ? 12 : 24;
  // Keep the image edge to edge and center the fleet within the available height.
  const artworkAspect = 1672 / 941;
  const fleetTop = 0.32;
  const fleetHeight = 0.44;
  const artworkWidth = artworkSize.width;
  const artworkHeight = artworkWidth * artworkAspect;
  // Favor the front car and wheels when a short screen needs a tighter vertical crop.
  const artworkTop = Math.min(
    (artworkSize.height - artworkHeight * fleetHeight) / 2 - artworkHeight * fleetTop,
    artworkSize.height - artworkHeight * 0.74,
  );

  if (status === 'authenticated') {
    return <Redirect href={user?.roles?.includes('driver') ? '/(driver)/services' : '/(tabs)'} />;
  }

  return (
    <View
      className="flex-1 bg-background"
      style={{
        paddingTop: insets.top + frameSpacing,
        paddingBottom: insets.bottom + frameSpacing,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" />
      <View
        className="w-full flex-1"
        style={{ flexDirection: isLandscape ? 'row' : 'column' }}>
        <View className="min-h-0 flex-1">
          <View className="items-center px-screen">
            <Text
              accessibilityRole="header"
              maxFontSizeMultiplier={welcomeTextScaleLimit}
              className="font-sans text-center font-bold text-foreground"
              style={{ fontSize: headingSize, lineHeight: headingSize * 1.08 }}>
              Your Journey{'\n'}Starts with{'\n'}
              <Text className="text-primary">JamJade{'\n'}Car Rental</Text>
            </Text>
          </View>
          <View
            className="min-h-0 flex-1 overflow-hidden"
            style={{ marginVertical: isCompact ? 8 : 16 }}
            onLayout={({ nativeEvent }) => {
              const { width: artworkAreaWidth, height: artworkAreaHeight } = nativeEvent.layout;
              setArtworkSize({ width: artworkAreaWidth, height: artworkAreaHeight });
            }}>
            <Image
              source={require('@/assets/images/mobile-welcome-bg.png')}
              resizeMode="contain"
              style={{
                position: 'absolute',
                right: 0,
                top: artworkTop,
                height: artworkHeight,
                width: artworkWidth,
              }}
              accessibilityLabel="JamJade rental fleet"
            />
          </View>
        </View>
        <View
          className="shrink-0 justify-center px-screen"
          style={{ gap: isCompact ? 8 : 12, width: isLandscape ? contentWidth * 0.5 : '100%' }}>
          <View className="relative overflow-hidden rounded-card border border-border bg-muted px-4 py-4">
            <View className="absolute left-4 right-4 top-0 h-1 rounded-full bg-primary" />
            <Text
              maxFontSizeMultiplier={welcomeTextScaleLimit}
              className={`font-sans text-center text-muted-foreground ${isCompact ? 'text-caption' : 'text-body'}`}>
              Reliable daily and long-term rentals for business trips, family errands, and
              weekend drives, with vehicles prepared for comfort, safety, and easy booking.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/vehicles')}
            className="min-h-control items-center justify-center overflow-hidden rounded-card border border-border bg-surface px-4 active:opacity-90">
            <Text maxFontSizeMultiplier={welcomeTextScaleLimit} className="font-sans text-center text-button font-medium text-foreground">
              Browse Available Cars
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/login')}
            className="min-h-control items-center justify-center overflow-hidden rounded-card border border-primary bg-primary px-4 active:opacity-90">
            <Text maxFontSizeMultiplier={welcomeTextScaleLimit} className="font-sans text-center text-button font-medium text-surface">
              Sign In or Create Account
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
