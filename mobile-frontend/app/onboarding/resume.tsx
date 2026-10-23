import { Redirect } from 'expo-router';
import { UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Text } from 'react-native';

import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingScreenFrame } from '@/components/onboarding/OnboardingScreenFrame';
import { BottomActionButton } from '@/components/ui/BottomActionButton';
import { useAuth } from '@/providers/AuthProvider';

export default function ResumeSetupScreen() {
  const { onboardingRoute, refreshProfile } = useAuth();
  const [isRetrying, setIsRetrying] = useState(false);

  if (onboardingRoute !== '/onboarding/resume') {
    return <Redirect href={onboardingRoute ?? '/(tabs)'} />;
  }

  const retry = async () => {
    if (isRetrying) {
      return;
    }

    setIsRetrying(true);
    try {
      await refreshProfile();
    } catch {
      // Keep the retry screen visible until saved setup progress can be read.
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <OnboardingScreenFrame
      action={
        <BottomActionButton
          disabled={isRetrying}
          label={isRetrying ? 'Loading...' : 'Try again'}
          onPress={() => void retry()}
        />
      }>
      <OnboardingHeader icon={UserRound} showBack={false} title="Resume setup" />
      <Text accessibilityRole="alert" className="font-sans mt-5 text-body text-secondary-foreground">
        Unable to load your saved progress. Check your connection and try again.
      </Text>
    </OnboardingScreenFrame>
  );
}
