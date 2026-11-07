import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingScreenFrame } from '@/components/onboarding/OnboardingScreenFrame';
import { DocumentRequirementRow } from '@/components/profile';
import { BottomActionButton } from '@/components/ui/BottomActionButton';
import { CUSTOMER_DOCUMENT_DEFINITIONS, hasDocumentDraft } from '@/lib/customer/document-verification';
import { useCustomer } from '@/lib/customer/customer-store';
import { useAuth } from '@/providers/AuthProvider';

export function DocumentVerificationListScreen({
  isOnboardingFlow = false,
  onBackPress,
}: {
  isOnboardingFlow?: boolean;
  onBackPress?: () => void;
}) {
  const router = useRouter();
  const customer = useCustomer();
  const { refreshProfile } = useAuth();

  useFocusEffect(
    useCallback(() => {
      void refreshProfile().catch(() => undefined);
    }, [refreshProfile]),
  );

  return (
    <OnboardingScreenFrame
      action={
        isOnboardingFlow ? (
          <BottomActionButton
            label="Continue later"
            onPress={() => router.replace('/onboarding/account-ready')}
          />
        ) : undefined
      }>
      <OnboardingHeader
        navigationTitle="Document Verification"
        onBackPress={onBackPress}
        title="Documents"
      />

      <View className="mt-section rounded-card border border-border bg-surface px-4">
        {CUSTOMER_DOCUMENT_DEFINITIONS.map((document, index) => (
          <DocumentRequirementRow
            definition={document}
            hasDraft={hasDocumentDraft(document.id, customer.documents)}
            isLast={index === CUSTOMER_DOCUMENT_DEFINITIONS.length - 1}
            key={document.id}
            onPress={() =>
              router.push(
                `/profile/documents/${document.id}${isOnboardingFlow ? '?source=onboarding' : ''}` as Href,
              )
            }
            status={customer.documentStatuses[document.id]}
          />
        ))}
      </View>
    </OnboardingScreenFrame>
  );
}

export function InvalidDocumentScreen() {
  const router = useRouter();

  return (
    <OnboardingScreenFrame
      action={
        <BottomActionButton
          label="Back to Documents"
          onPress={() => router.replace('/profile/documents' as Href)}
        />
      }>
      <OnboardingHeader
        navigationTitle="Document Verification"
        subtitle="The selected document type is not available."
        title="Document not found"
      />
    </OnboardingScreenFrame>
  );
}
