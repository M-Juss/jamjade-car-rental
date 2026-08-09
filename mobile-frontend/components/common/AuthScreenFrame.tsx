import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type AuthMode = 'login' | 'register';

type AuthScreenFrameProps = PropsWithChildren<{
  mode: AuthMode;
}>;

type BreakpointFlags = {
  isCompact: boolean;
  isTiny: boolean;
  topPadding: number;
};

const AUTH_MODE_CONFIG = {
  login: {
    label: 'Login',
    route: '/login',
  },
  register: {
    label: 'Register',
    route: '/register',
  },
} as const;

const AUTH_HEADER_COPY = {
  brand: 'JamJade',
  service: 'Car Rental',
  tagline: 'Premium rides, ready when you are',
};

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function DecorativeCircle({ className }: { className: string }) {
  return <View className={className} />;
}

function AuthHeroHeader({ isCompact, isTiny, topPadding }: BreakpointFlags) {
  return (
    <View
      className={cx(
        'min-h-[214px] items-center overflow-hidden px-7 pb-12',
        isCompact && 'min-h-[190px] pb-10',
        isTiny && 'min-h-[170px] px-6 pb-9',
      )}
      style={{ paddingTop: topPadding }}>
      <DecorativeCircle className="absolute right-[-112px] top-[-42px] h-[260px] w-[260px] rounded-full bg-border" />
      <DecorativeCircle className="absolute left-[-124px] top-[-126px] h-[250px] w-[250px] rounded-full bg-surface" />
      <DecorativeCircle className="absolute right-12 top-[118px] h-5 w-5 rounded-full bg-[#BFD7FF]" />

      <View className="z-10 w-full max-w-[430px] items-center self-center">
        <Text
          className={cx(
            'text-center text-[42px] font-black italic leading-[44px] text-primary',
            isTiny && 'text-[35px] leading-[38px]',
          )}>
          {AUTH_HEADER_COPY.brand}
        </Text>
        <Text
          className={cx(
            'text-center text-[34px] font-black italic leading-[36px] text-primary',
            isTiny && 'text-[28px] leading-[31px]',
          )}>
          {AUTH_HEADER_COPY.service}
        </Text>
        <Text
          className={cx(
            'mt-2 text-center text-[11px] font-bold uppercase tracking-[1.8px] text-muted-foreground',
            isTiny && 'text-[10px] tracking-[1.4px]',
          )}>
          {AUTH_HEADER_COPY.tagline}
        </Text>
      </View>
    </View>
  );
}

function AuthCardDecorations() {
  return (
    <>
      <DecorativeCircle className="absolute bottom-[-48px] right-8 h-28 w-28 rounded-full bg-[#EAF7F1]" />
    </>
  );
}

function AuthModeSwitch({
  mode,
  onModeChange,
}: {
  mode: AuthMode;
  onModeChange: (nextMode: AuthMode) => void;
}) {
  return (
    <View className="z-10 mb-5 min-h-[54px] flex-row items-center rounded-full bg-muted p-1.5">
      {(Object.keys(AUTH_MODE_CONFIG) as AuthMode[]).map((authMode) => {
        const isActive = mode === authMode;

        return (
          <Pressable
            key={authMode}
            accessibilityRole="button"
            onPress={() => onModeChange(authMode)}
            className={cx(
              'min-h-[42px] flex-1 items-center justify-center rounded-full',
              isActive && 'bg-primary shadow-md shadow-primary/20',
            )}>
            <Text
              className={cx(
                'text-[15px] font-bold',
                isActive ? 'text-surface' : 'text-foreground',
              )}>
              {AUTH_MODE_CONFIG[authMode].label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AuthScreenFrame({ mode, children }: AuthScreenFrameProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const isCompact = height < 860;
  const isTiny = height < 720 || width < 360;
  const headerTopPadding = Math.max(
    insets.top + (isTiny ? 8 : 12),
    isTiny ? 28 : isCompact ? 36 : 40,
  );
  const sheetBottomPadding = Math.max(
    insets.bottom + (isTiny ? 14 : 18),
    isTiny ? 24 : isCompact ? 28 : 34,
  );

  const handleModeChange = (nextMode: AuthMode) => {
    if (nextMode === mode) {
      return;
    }

    router.replace(AUTH_MODE_CONFIG[nextMode].route);
  };

  return (
    <View className="flex-1 bg-background">
      <StatusBar backgroundColor="transparent" style="dark" translucent />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <View className="flex-1 w-full overflow-hidden bg-background">
          <AuthHeroHeader isCompact={isCompact} isTiny={isTiny} topPadding={headerTopPadding} />

          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            className="-mt-8 flex-1"
            contentContainerStyle={{ paddingBottom: sheetBottomPadding }}
            contentContainerClassName={cx(
              'relative grow overflow-hidden rounded-t-[34px] border border-border bg-surface px-5 pt-4 shadow-2xl shadow-primary/15',
              isCompact && 'pt-[18px]',
            )}>
            <AuthCardDecorations />
            <View className="z-10 w-full max-w-[430px] self-center">
              <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-[#BFD0F4]" />
              <AuthModeSwitch mode={mode} onModeChange={handleModeChange} />
              <View>{children}</View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
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
        'min-h-[52px] items-center justify-center rounded-full bg-primary shadow-lg shadow-[#004BFA]/20',
        disabled && 'bg-[#AFC5FF] shadow-none',
      )}>
      <Text className="text-[15px] font-extrabold text-surface">{label}</Text>
    </Pressable>
  );
}
