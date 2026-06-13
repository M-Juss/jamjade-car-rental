import { useRouter, type Href } from 'expo-router';
import { CarFront, FileCheck2, PhoneCall, ShieldCheck } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { InfoCard } from '@/components/onboarding/InfoCard';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingScreenFrame } from '@/components/onboarding/OnboardingScreenFrame';
import { BottomActionButton } from '@/components/ui/BottomActionButton';

export default function GetStartedScreen() {
  const router = useRouter();

  return (
    <OnboardingScreenFrame
      action={
        <BottomActionButton
          label="Start Profile Setup"
          onPress={() => router.push('/onboarding/basic-info' as Href)}
        />
      }>
      <OnboardingHeader
        icon={CarFront}
        showBack={false}
        subtitle="This helps us prepare your rental experience and apply the right driving options for your account."
        title="Let's complete your profile."
      />

      <View className="mt-7 rounded-[28px] border border-[#D6E5FF] bg-[#17315F] p-5 shadow-xl shadow-[#17315F]/15">
        <Text className="text-[19px] font-black leading-6 text-white">Fast setup, clearer bookings</Text>
        <Text className="mt-2 text-[13px] font-semibold leading-5 text-[#D8E5FF]">
          Browse and owner-driver bookings are available to customers. Self-drive is only unlocked after eligibility
          and document review.
        </Text>
      </View>

      <View className="mt-5">
        <InfoCard
          items={[
            { icon: ShieldCheck, label: 'Basic profile', value: 'Name, contact number, birthdate, and address.' },
            { icon: PhoneCall, label: 'Emergency contact', value: 'Optional during setup, editable later from Profile.' },
            { icon: FileCheck2, label: 'Driving documents', value: 'Only needed for eligible self-drive rentals.' },
          ]}
          title="Setup checklist"
        />
      </View>
    </OnboardingScreenFrame>
  );
}
