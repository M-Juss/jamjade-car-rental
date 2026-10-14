import { useRouter, type Href } from 'expo-router';
import { CarFront, ShieldAlert } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { InfoCard } from '@/components/onboarding/InfoCard';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingScreenFrame } from '@/components/onboarding/OnboardingScreenFrame';
import { BottomActionButton } from '@/components/ui/BottomActionButton';
import { BOOKING_AGE_RESTRICTION_MESSAGE } from '@/utils/calculateAge';

export default function AgeRestrictionScreen() {
  const router = useRouter();

  return (
    <OnboardingScreenFrame
      action={
        <BottomActionButton label="Back to Browse" onPress={() => router.replace('/(tabs)' as Href)} />
      }>
      <OnboardingHeader
        icon={ShieldAlert}
        subtitle={BOOKING_AGE_RESTRICTION_MESSAGE}
        title="Booking unavailable"
      />

      <View
        accessibilityRole="alert"
        className="mt-7 rounded-card border border-warning-border bg-warning-surface p-5">
        <Text className="font-sans text-[17px] font-semibold text-warning">
          You can still browse vehicles
        </Text>
        <Text className="font-sans mt-2 text-[13px] font-semibold leading-5 text-warning">
          For safety and rental eligibility, booking remains disabled until the account meets the minimum age
          requirement.
        </Text>
      </View>

      <View className="mt-5">
        <InfoCard
          items={[
            { icon: CarFront, label: 'Browse vehicles', value: 'Allowed', allowed: true },
            { label: "Book with owner's driver", value: 'Not available', allowed: false },
            { label: 'Self-drive', value: 'Not available', allowed: false },
          ]}
          title="Your booking access"
        />
      </View>
    </OnboardingScreenFrame>
  );
}
