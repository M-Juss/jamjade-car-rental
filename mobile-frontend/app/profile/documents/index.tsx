import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { DocumentVerificationListScreen } from '@/screens/profile/DocumentVerificationListScreen';

export default function DocumentsRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ source?: string | string[] }>();
  const source = Array.isArray(params.source) ? params.source[0] : params.source;
  const isOnboardingFlow = source === 'onboarding';

  return (
    <DocumentVerificationListScreen
      isOnboardingFlow={isOnboardingFlow}
      onBackPress={
        isOnboardingFlow
          ? () => router.replace('/onboarding/account-ready' as Href)
          : undefined
      }
    />
  );
}
