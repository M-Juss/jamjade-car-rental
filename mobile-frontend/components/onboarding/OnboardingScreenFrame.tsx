import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardFormScrollView } from '@/components/common/KeyboardFormScrollView';

export function OnboardingScreenFrame({ action, children }: { children: ReactNode; action?: ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <KeyboardFormScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingBottom: action ? 24 : Math.max(insets.bottom + 28, 44),
            paddingTop: insets.top + 10,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View className="w-full max-w-[460px] self-center px-5">{children}</View>
        </KeyboardFormScrollView>
        {action}
      </KeyboardAvoidingView>
    </View>
  );
}
