import { useRouter, type Href } from 'expo-router';
import { FileCheck2, ShieldCheck } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { InfoCard } from '@/components/onboarding/InfoCard';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingScreenFrame } from '@/components/onboarding/OnboardingScreenFrame';
import { BottomActionButton } from '@/components/ui/BottomActionButton';
import { updateSelfDriveStatus } from '@/lib/customer/customer-store';

export default function SelfDriveVerificationScreen() {
  const router = useRouter();

  const handleVerifyLater = () => {
    updateSelfDriveStatus('not-verified');
    router.replace('/(tabs)' as Href);
  };

  return (
    <OnboardingScreenFrame
      action={
        <BottomActionButton
          label="Verify Now"
          onPress={() => router.push('/onboarding/document-verification' as Href)}
          secondaryLabel="Verify Later"
          onSecondaryPress={handleVerifyLater}
        />
      }>
      <OnboardingHeader
        currentStep={4}
        icon={ShieldCheck}
        subtitle="To use self-drive rental, please verify your documents first. This helps Jamjade confirm your identity and protect the vehicle."
        title="Verify Your Driving Documents"
        totalSteps={4}
      />

      <View className="mt-7 rounded-[28px] border border-[#D6E5FF] bg-white p-5 shadow-md shadow-[#17315F]/5">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-[#EEF4FF]">
          <FileCheck2 size={22} color="#346EF6" strokeWidth={2.45} />
        </View>
        <Text className="mt-4 text-[18px] font-black text-[#17315F]">Self-drive requires review</Text>
        <Text className="mt-2 text-[13px] font-semibold leading-5 text-[#6C7A96]">
          You can verify later from your profile. Until approval, owner&apos;s driver booking stays available.
        </Text>
      </View>

      <View className="mt-5">
        <InfoCard
          items={[
            { label: "Driver's License", value: 'License number, expiration date, front and back images.' },
            { label: 'Valid ID', value: 'A clear government-issued ID image.' },
            { label: 'Proof of Address / Meralco Bill', value: 'A recent utility bill or proof of billing.' },
            { label: 'Passport', value: 'Optional unless required by admin.' },
          ]}
          title="Required documents"
        />
      </View>
    </OnboardingScreenFrame>
  );
}
