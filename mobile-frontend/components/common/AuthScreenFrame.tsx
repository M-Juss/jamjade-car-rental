import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { PropsWithChildren } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { themeColors } from '@/constants/theme';
import { KeyboardFormScrollView } from '@/components/common/KeyboardFormScrollView';

type AuthMode = 'login' | 'register';

export function AuthScreenFrame({ mode, children }: PropsWithChildren<{ mode: AuthMode }>) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isLogin = mode === 'login';

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">
        <KeyboardFormScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}>
          <View className="w-full max-w-[460px] self-center px-screen">
            <View className="mb-6 min-h-11 flex-row items-center justify-between gap-3 border-b border-border pb-3 pt-1">
              <View
                accessible
                accessibilityLabel="JamJade Car Rental"
                className="shrink flex-row items-center gap-1">
                <Image
                  source={require('@/assets/images/JamJadeLogo-solid.png')}
                  resizeMode="contain"
                  accessible={false}
                  // Keep the full square asset visible; only its transparent margins extend past the header row.
                  style={{ height: 56, width: 56, marginTop: -2, marginBottom: -6, flexShrink: 0 }}
                />
                <View className="shrink">
                  <Text
                    className="font-sans text-[13px] font-bold leading-[13px] text-primary"
                    style={{ includeFontPadding: false }}>
                    JamJade{'\n'}Car Rental
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to welcome"
                onPress={() => router.replace('/')}
                className="h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface">
                <ArrowLeft size={21} color={themeColors.foreground} />
              </Pressable>
            </View>
            <Text accessibilityRole="header" className="font-sans text-center text-title font-semibold text-foreground">
              {isLogin ? 'Welcome back' : 'Create an account'}
            </Text>
            <Text className="font-sans mt-2 text-center text-body text-secondary-foreground">
              {isLogin ? 'Sign in to continue your journey.' : 'Your next journey starts here.'}
            </Text>
            <View className="mt-6 rounded-card border border-border bg-surface p-card">{children}</View>
            <View className="mt-4 flex-row flex-wrap items-center justify-center">
              <Text className="font-sans text-[14px] text-secondary-foreground">
                {isLogin ? 'New to JamJade?' : 'Already have an account?'}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace(isLogin ? '/register' : '/login')}
                className="min-h-11 justify-center px-2">
                <Text className="font-sans text-[14px] font-semibold text-primary">
                  {isLogin ? 'Create account' : 'Sign in'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardFormScrollView>
      </View>
    </View>
  );
}

export function AuthSubmitButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-control items-center justify-center rounded-full bg-primary px-4 py-3 ${disabled ? 'opacity-50' : 'active:opacity-90'}`}>
      <Text className="font-sans text-button font-medium text-surface">{label}</Text>
    </Pressable>
  );
}
