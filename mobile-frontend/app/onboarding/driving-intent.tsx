import { useRouter, type Href } from 'expo-router';
import { CarFront, CircleHelp, ShieldCheck, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingScreenFrame } from '@/components/onboarding/OnboardingScreenFrame';
import { SelectableCard } from '@/components/onboarding/SelectableCard';
import { BottomActionButton } from '@/components/ui/BottomActionButton';
import {
  updateDrivingIntent,
  useCustomer,
} from '@/lib/customer/customer-store';
import type { DrivingIntent } from '@/types/customer';

export default function DrivingIntentScreen() {
  const router = useRouter();
  const customer = useCustomer();
  const [intent, setIntent] = useState<DrivingIntent>(customer.drivingIntent);
  const [error, setError] = useState('');

  const handleContinue = () => {
    if (!intent) {
      setError('Choose a driving option to continue.');
      return;
    }

    updateDrivingIntent(intent);

    if (intent === 'self-drive') {
      router.push('/onboarding/self-drive-verification' as Href);
      return;
    }

    if (intent === 'owner-driver') {
      router.push('/onboarding/owner-driver-confirmation' as Href);
      return;
    }

    router.push('/onboarding/not-sure' as Href);
  };

  const selectIntent = (nextIntent: DrivingIntent) => {
    setIntent(nextIntent);
    setError('');
  };

  return (
    <OnboardingScreenFrame
      action={<BottomActionButton label="Continue" onPress={handleContinue} />}>
      <OnboardingHeader
        currentStep={3}
        icon={CarFront}
        subtitle="You can choose owner's driver now, apply for self-drive, or decide later during booking."
        title="Do you plan to self-drive?"
        totalSteps={4}
      />

      <View className="mt-7 gap-3">
        <SelectableCard
          description="You will need to verify your driving documents before using self-drive booking."
          icon={ShieldCheck}
          isSelected={intent === 'self-drive'}
          onPress={() => selectIntent('self-drive')}
          title="Yes, I want to self-drive"
        />
        <SelectableCard
          description="You can book vehicles with Jamjade's owner's driver."
          icon={UserRound}
          isSelected={intent === 'owner-driver'}
          onPress={() => selectIntent('owner-driver')}
          title="No, I prefer owner's driver"
        />
        <SelectableCard
          description="You can decide later from your profile or during booking."
          icon={CircleHelp}
          isSelected={intent === 'not-sure'}
          onPress={() => selectIntent('not-sure')}
          title="Not sure yet"
        />
      </View>

      {error ? (
        <Text className="mt-3 rounded-[20px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[12px] font-bold leading-5 text-[#D92D20]">
          {error}
        </Text>
      ) : null}
    </OnboardingScreenFrame>
  );
}
