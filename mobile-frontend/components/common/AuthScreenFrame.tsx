import { useRouter } from 'expo-router';
import { type PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type AuthMode = 'login' | 'register';

type AuthScreenFrameProps = PropsWithChildren<{
  mode: AuthMode;
}>;

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function AuthScreenFrame({ mode, children }: AuthScreenFrameProps) {
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const isCompact = height < 860;

  const handleModeChange = (nextMode: AuthMode) => {
    if (nextMode === mode) {
      return;
    }

    router.replace(nextMode === 'login' ? '/(auth)/login' : '/(auth)/register');
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFF]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <View
          className={cx(
            'flex-1 w-full max-w-[430px] self-center overflow-hidden bg-[#F8FAFF]',
            width > 520 && 'my-5 rounded-[36px] border border-[#DDE8FF] shadow-2xl shadow-[#346EF6]/20',
          )}>
          <View
            className={cx(
              'min-h-[196px] items-center justify-center px-7 pb-6 pt-7',
              isCompact && 'min-h-[170px] pb-4 pt-5',
            )}>
            <View className="absolute right-[-94px] top-9 h-[260px] w-[260px] rounded-full bg-[#DDE8FF] opacity-95" />
            <View className="absolute left-[-104px] top-[-104px] h-[270px] w-[270px] rounded-full bg-white" />

            <Text className="text-7xl  font-black italic leading-[52px] text-[#346EF6]">
              JamJade
            </Text>
            <Text className="text-center text-[28px] font-semibold leading-[32px] text-[#346EF6]">
              Car Rental
            </Text>
          </View>

          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            className="flex-1"
            contentContainerClassName={cx(
              'grow rounded-t-[30px] bg-white px-5 pb-7 pt-5 shadow-lg shadow-[#346EF6]/10',
              isCompact && 'pb-6 pt-[18px]',
            )}>
            <View className="mb-5 min-h-[54px] flex-row items-center rounded-full bg-[#EEF4FF] p-1.5">
              <Pressable
                accessibilityRole="button"
                onPress={() => handleModeChange('login')}
                className={cx(
                  'min-h-[42px] flex-1 items-center justify-center rounded-full',
                  mode === 'login' && 'bg-[#346EF6] shadow-md shadow-[#346EF6]/20',
                )}>
                <Text
                  className={cx(
                    'text-[15px] font-bold',
                    mode === 'login' ? 'text-white' : 'text-[#17315F]',
                  )}>
                  Log In
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => handleModeChange('register')}
                className={cx(
                  'min-h-[42px] flex-1 items-center justify-center rounded-full',
                  mode === 'register' && 'bg-[#346EF6] shadow-md shadow-[#346EF6]/20',
                )}>
                <Text
                  className={cx(
                    'text-[15px] font-bold',
                    mode === 'register' ? 'text-white' : 'text-[#17315F]',
                  )}>
                  Sign Up
                </Text>
              </Pressable>
            </View>

            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type AuthSubmitButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function AuthSubmitButton({ label, onPress, disabled = false }: AuthSubmitButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={cx(
        'min-h-[52px] items-center justify-center rounded-full bg-[#346EF6] shadow-lg shadow-[#004BFA]/20',
        disabled && 'bg-[#AFC5FF] shadow-none',
      )}>
      <Text className="text-[15px] font-extrabold text-white">{label}</Text>
    </Pressable>
  );
}
