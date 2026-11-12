import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { PropsWithChildren } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { themeColors } from '@/constants/theme';
import { KeyboardFormScrollView } from '@/components/common/KeyboardFormScrollView';

type AuthMode = 'login' | 'register' | 'verification';

export function AuthScreenFrame({
  mode,
  children,
  description,
  title,
  backLabel,
  onBack,
  disableBack = false,
  hideFooter = false,
}: PropsWithChildren<{ mode: AuthMode; title?: string; backLabel?: string; description?: string; onBack?: () => void; disableBack?: boolean; hideFooter?: boolean }>) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isLogin = mode === 'login';
  const isVerification = mode === 'verification';

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">
        <KeyboardFormScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}>
          <View className="w-full max-w-[460px] self-center px-screen">
            <View className="mb-section min-h-12 flex-row items-center gap-3 border-b border-border pb-3 pt-1">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={backLabel ?? (isVerification ? 'Back to registration' : 'Back to welcome')}
                accessibilityState={{ disabled: disableBack }}
                disabled={disableBack}
                onPress={onBack ?? (() => router.replace('/'))}
                className={`h-11 w-11 shrink-0 items-center justify-center rounded-field ${disableBack ? 'opacity-50' : ''}`}>
                <ArrowLeft size={21} color={themeColors.foreground} strokeWidth={2} />
              </Pressable>
              <View
                accessible
                accessibilityLabel="JamJade Car Rental"
                className="min-w-0 flex-1 flex-row items-center justify-center gap-2">
                <Image
                  source={require('@/assets/images/JamJadeLogo-solid.png')}
                  resizeMode="contain"
                  accessible={false}
                  style={{ height: 48, width: 48, flexShrink: 0 }}
                />
                <Text className="font-sans shrink text-body font-semibold text-primary">JamJade Car Rental</Text>
              </View>
              <View className="w-11 shrink-0" />
            </View>
            <Text accessibilityRole="header" className="font-sans text-center text-title font-semibold text-foreground">
              {title ?? (isLogin ? 'Welcome back' : isVerification ? 'Verify your email' : 'Create an account')}
            </Text>
            <Text className="font-sans mt-2 text-center text-body text-secondary-foreground">
              {description ?? (isLogin ? 'Sign in to continue your journey.' : 'Your next journey starts here.')}
            </Text>
            <View className="mt-section rounded-card border border-border bg-surface p-card">{children}</View>
            {!hideFooter ? <View className="mt-4 flex-row flex-wrap items-center justify-center">
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
            </View> : null}
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
      className={`min-h-control items-center justify-center rounded-field bg-primary px-4 py-3 ${disabled ? 'opacity-50' : 'active:opacity-90'}`}>
      <Text className="font-sans text-button font-medium text-surface">{label}</Text>
    </Pressable>
  );
}
