import { useRouter, type Href } from 'expo-router';
import { CircleHelp, FileCheck2 } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingScreenFrame } from '@/components/onboarding/OnboardingScreenFrame';
import { BottomActionButton } from '@/components/ui/BottomActionButton';

export default function NotSureScreen() {
  const router = useRouter();

  const handleContinue = () => {
    router.replace('/(tabs)' as Href);
  };

  return (
    <OnboardingScreenFrame action={<BottomActionButton label="Continue to App" onPress={handleContinue} />}>
      <View className="min-h-[640px] justify-center">
        <OnboardingHeader
          icon={CircleHelp}
          showBack={false}
          subtitle="You can continue using the app and decide later. Self-drive verification will be available in your profile."
          title="No Problem"
        />

        <View className="mt-7 rounded-[28px] border border-[#D6E5FF] bg-white p-5 shadow-md shadow-[#17315F]/5">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-[#EEF4FF]">
            <FileCheck2 size={22} color="#346EF6" strokeWidth={2.45} />
          </View>
          <Text className="mt-4 text-[18px] font-black text-[#17315F]">Decide when you are ready</Text>
          <Text className="mt-2 text-[13px] font-semibold leading-5 text-[#6C7A96]">
            Owner&apos;s driver booking remains available. Self-drive will stay locked until documents are submitted and approved.
          </Text>
        </View>
      </View>
    </OnboardingScreenFrame>
  );
}
