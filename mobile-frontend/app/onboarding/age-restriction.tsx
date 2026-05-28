import { useRouter, type Href } from 'expo-router';
import { CarFront, ShieldAlert } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { InfoCard } from '@/components/onboarding/InfoCard';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingScreenFrame } from '@/components/onboarding/OnboardingScreenFrame';
import { BottomActionButton } from '@/components/ui/BottomActionButton';

export default function AgeRestrictionScreen() {
  const router = useRouter();

  return (
    <OnboardingScreenFrame
      action={
        <BottomActionButton
          label="Continue to App"
          onPress={() => router.replace('/(tabs)' as Href)}
        />
      }>
      <OnboardingHeader
        currentStep={3}
        icon={ShieldAlert}
        subtitle="You can browse and book vehicles, but self-driving is only available for customers who are 18 years old and above. You may still book vehicles with an owner's driver."
        title="Owner's Driver Only"
        totalSteps={3}
      />

      <View className="mt-7 rounded-[28px] border border-[#FED7AA] bg-[#FFF7ED] p-5">
        <Text className="text-[17px] font-black text-[#C2410C]">Self-drive is not available yet</Text>
        <Text className="mt-2 text-[13px] font-semibold leading-5 text-[#806128]">
          Your account can continue to the main customer app with owner-driver booking enabled.
        </Text>
      </View>

      <View className="mt-5">
        <InfoCard
          items={[
            { icon: CarFront, label: 'Browse vehicles', value: 'Allowed', allowed: true },
            { label: "Book with owner's driver", value: 'Allowed', allowed: true },
            { label: 'Self-drive', value: 'Not available', allowed: false },
          ]}
          title="Your booking access"
        />
      </View>
    </OnboardingScreenFrame>
  );
}
