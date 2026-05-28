import { useRouter, type Href } from 'expo-router';
import { ShieldCheck, UserRound } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingScreenFrame } from '@/components/onboarding/OnboardingScreenFrame';
import { BottomActionButton } from '@/components/ui/BottomActionButton';

export default function OwnerDriverConfirmationScreen() {
  const router = useRouter();

  const handleContinue = () => {
    router.replace('/(tabs)' as Href);
  };

  return (
    <OnboardingScreenFrame action={<BottomActionButton label="Continue to App" onPress={handleContinue} />}>
      <View className="min-h-[640px] justify-center">
        <OnboardingHeader
          icon={UserRound}
          showBack={false}
          subtitle="You can book vehicles with Jamjade's owner's driver. Self-drive can still be enabled later after document verification."
          title="Owner's Driver Selected"
        />

        <View className="mt-7 rounded-[28px] border border-[#D6E5FF] bg-white p-5 shadow-md shadow-[#17315F]/5">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-[#EEF4FF]">
            <ShieldCheck size={22} color="#346EF6" strokeWidth={2.45} />
          </View>
          <Text className="mt-4 text-[18px] font-black text-[#17315F]">Ready for owner-driver bookings</Text>
          <Text className="mt-2 text-[13px] font-semibold leading-5 text-[#6C7A96]">
            Self-drive verification remains available from your Profile whenever you want to apply.
          </Text>
        </View>
      </View>
    </OnboardingScreenFrame>
  );
}
