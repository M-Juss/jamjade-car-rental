import { useRouter } from 'expo-router';
import { ArrowLeft, type LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { ProgressSteps } from '@/components/onboarding/ProgressSteps';

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

  return (
    <View>
      <View className="min-h-[48px] flex-row items-center gap-3">
        {showBack ? (
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={onBackPress ?? (() => router.back())}
            className="h-12 w-12 items-center justify-center rounded-full border border-border bg-surface">
            <ArrowLeft size={21} color="#17315F" strokeWidth={2.45} />
          </Pressable>
        ) : null}
        {navigationTitle ? (
          <Text className="min-w-0 flex-1 text-center text-[19px] font-black text-foreground" numberOfLines={1}>
            {navigationTitle}
          </Text>
        ) : (
          <View className="min-w-0 flex-1">
            <Text className="text-[13px] font-black text-primary">Jamjade Car Rental</Text>
            <Text className="text-[12px] font-bold text-muted-foreground">Customer setup</Text>
          </View>
        )}
        {navigationTitle && showBack ? <View className="h-12 w-12" /> : Icon ? (
          <View className="h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Icon size={22} color="#346EF6" strokeWidth={2.45} />
          </View>
        ) : null}
      </View>

      {currentStep && totalSteps ? (
        <View className="mt-5">
          <ProgressSteps currentStep={currentStep} totalSteps={totalSteps} />
        </View>
      ) : null}

      <Text className="mt-6 text-[30px] font-black leading-[35px] text-foreground">{title}</Text>
      <Text className="mt-2 text-[14px] font-semibold leading-6 text-muted-foreground">{subtitle}</Text>
    </View>
  );
}
