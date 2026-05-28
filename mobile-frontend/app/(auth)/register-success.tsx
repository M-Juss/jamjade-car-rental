import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { OnboardingScreenFrame } from '@/components/onboarding/OnboardingScreenFrame';
import { BottomActionButton } from '@/components/ui/BottomActionButton';
import { updateRegisteredEmail } from '@/lib/customer/customer-store';

export default function RegisterSuccessScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();

  useEffect(() => {
    if (email) {
      updateRegisteredEmail(email);
    }
  }, [email]);

  return (
    <OnboardingScreenFrame
      action={
        <BottomActionButton
          label="Get Started"
          onPress={() => router.replace('/onboarding/get-started' as Href)}
        />
      }>
      <View className="min-h-[620px] justify-center">
        <View className="items-center">
          <View className="h-[106px] w-[106px] items-center justify-center rounded-full bg-[#ECFDF5]">
            <CheckCircle2 size={54} color="#047857" strokeWidth={2.4} />
          </View>
          <Text className="mt-8 text-center text-[31px] font-black leading-[36px] text-[#17315F]">
            Account Created Successfully
          </Text>
          <Text className="mt-3 text-center text-[15px] font-semibold leading-6 text-[#6C7A96]">
            Let&apos;s complete your profile so you can start booking vehicles.
          </Text>
        </View>

        <View className="mt-9 rounded-[28px] border border-[#DDE8FF] bg-white p-5 shadow-md shadow-[#17315F]/5">
          <Text className="text-[16px] font-black text-[#17315F]">What happens next?</Text>
          <Text className="mt-2 text-[13px] font-semibold leading-5 text-[#6C7A96]">
            We will ask for your basic details, emergency contact, and self-drive preference. You can still book
            with an owner&apos;s driver even if self-drive verification is not ready yet.
          </Text>
        </View>
      </View>
    </OnboardingScreenFrame>
  );
}
