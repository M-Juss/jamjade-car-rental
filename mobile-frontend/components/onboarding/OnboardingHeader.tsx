import { themeColors } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { ArrowLeft, type LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { ProgressSteps } from '@/components/onboarding/ProgressSteps';
import { LogoutHeaderButton } from '@/components/auth/LogoutHeaderButton';
import { useAuth } from '@/providers/AuthProvider';

type OnboardingHeaderProps = {
  title: string;
  subtitle: string;
  icon?: LucideIcon;
  currentStep?: number;
  totalSteps?: number;
  showBack?: boolean;
  onBackPress?: () => void;
  navigationTitle?: string;
};

export function OnboardingHeader({
  currentStep,
  icon: Icon,
  navigationTitle,
  onBackPress,
  showBack = true,
  subtitle,
  title,
  totalSteps,
}: OnboardingHeaderProps) {
  const router = useRouter();
  const { status } = useAuth();

  return (
    <View>
      <View className="min-h-[48px] flex-row items-center gap-3">
        {showBack ? (
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={onBackPress ?? (() => router.back())}
            className="h-11 w-11 items-center justify-center rounded-full border border-border bg-surface">
            <ArrowLeft size={21} color={themeColors.foreground} strokeWidth={2.45} />
          </Pressable>
        ) : null}
        {navigationTitle ? (
          <Text
            className="font-sans min-w-0 flex-1 text-center text-[19px] font-semibold text-foreground"
            numberOfLines={1}>
            {navigationTitle}
          </Text>
        ) : (
          <View className="min-w-0 flex-1">
            <Text className="font-sans text-[13px] font-semibold text-primary">Jamjade Car Rental</Text>
            <Text className="font-sans text-[12px] font-medium text-secondary-foreground">
              Customer setup
            </Text>
          </View>
        )}
        {status === 'authenticated' ? (
          <LogoutHeaderButton />
        ) : navigationTitle && showBack ? (
          <View className="h-11 w-11" />
        ) : Icon ? (
          <View className="h-11 w-11 items-center justify-center rounded-full bg-muted">
            <Icon size={22} color={themeColors.primary} strokeWidth={2.45} />
          </View>
        ) : null}
      </View>

      {currentStep && totalSteps ? (
        <View className="mt-4">
          <ProgressSteps currentStep={currentStep} totalSteps={totalSteps} />
        </View>
      ) : null}

      <Text className="font-sans mt-5 text-title font-semibold text-foreground">{title}</Text>
      <Text className="font-sans mt-2 text-body text-secondary-foreground">{subtitle}</Text>
    </View>
  );
}
