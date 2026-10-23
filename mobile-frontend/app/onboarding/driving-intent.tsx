import { useRouter, type Href } from 'expo-router';
import { CarFront, CircleHelp, ShieldCheck, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingScreenFrame } from '@/components/onboarding/OnboardingScreenFrame';
import { SelectableCard } from '@/components/onboarding/SelectableCard';
import { BottomActionButton } from '@/components/ui/BottomActionButton';
import { useCustomer } from '@/lib/customer/customer-store';
import type { DrivingIntent } from '@/types/customer';
import { FormToast, useFormToast } from '@/forms/shared/FormToast';
import { completeProfile } from '@/services/api';
import { ApiError } from '@/services/http';
import { useAuth } from '@/providers/AuthProvider';

function toApiDrivingIntent(intent: Exclude<DrivingIntent, null>) {
  return intent.replaceAll('-', '_') as 'self_drive' | 'owner_driver' | 'not_sure';
}

export default function DrivingIntentScreen() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const customer = useCustomer();
  const [intent, setIntent] = useState<DrivingIntent>(customer.drivingIntent);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useFormToast();

  const handleContinue = async () => {
    if (isSubmitting) {
      return;
    }

    if (!intent) {
      setError('Choose a driving option to continue.');
      return;
    }

    setIsSubmitting(true);

    try {
      await completeProfile({ drivingIntent: toApiDrivingIntent(intent) });
      await refreshProfile();
      const nextRoute = (
        intent === 'self-drive' ? '/profile/documents?source=onboarding' : '/onboarding/account-ready'
      ) as Href;

      router.replace(nextRoute);
    } catch (submitError) {
      toast.showToast(
        submitError instanceof ApiError && submitError.status === 0
          ? 'Unable to connect right now. Please try again.'
          : 'Unable to complete your profile.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectIntent = (nextIntent: DrivingIntent) => {
    setIntent(nextIntent);
    setError('');
  };

  return (
    <View className="flex-1">
      <OnboardingScreenFrame
        action={
          <BottomActionButton
            disabled={isSubmitting}
            label={isSubmitting ? 'Saving...' : 'Continue'}
            onPress={handleContinue}
          />
        }>
        <OnboardingHeader
          currentStep={3}
          icon={CarFront}
          subtitle="You can choose owner's driver now, apply for self-drive, or decide later during booking."
          title="Do you plan to self-drive?"
          totalSteps={3}
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
          <Text className="font-sans mt-3 rounded-[20px] border border-destructive-border bg-destructive-surface px-4 py-3 text-[12px] font-medium leading-5 text-destructive">
            {error}
          </Text>
        ) : null}
      </OnboardingScreenFrame>
      <FormToast
        message={toast.message}
        onDismiss={toast.clearToast}
        title={toast.title}
        variant={toast.variant}
      />
    </View>
  );
}
