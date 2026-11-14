import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingScreenFrame } from '@/components/onboarding/OnboardingScreenFrame';
import { DocumentRequirementRow } from '@/components/profile';
import { DocumentPrivacyNotice, useDocumentPrivacyAgreement } from '@/components/profile/DocumentPrivacyNotice';
import { BottomActionButton, BottomActionFooter } from '@/components/ui/BottomActionButton';
import { FormToast, useFormToast } from '@/forms/shared/FormToast';
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
  const { accepted } = useDocumentPrivacyAgreement();
  const toast = useFormToast();

  useFocusEffect(
    useCallback(() => {
      void refreshProfile().catch(() => undefined);
    }, [refreshProfile]),
  );

  return (
    <View className="flex-1 bg-background">
      <OnboardingScreenFrame
        action={
          isOnboardingFlow ? (
            <BottomActionButton
              footer={<DocumentPrivacyNotice />}
              label="Continue later"
              onPress={() => router.replace('/onboarding/account-ready')}
            />
          ) : (
            <BottomActionFooter><DocumentPrivacyNotice /></BottomActionFooter>
          )
        }>
        <OnboardingHeader
          navigationTitle="Documents"
          onBackPress={onBackPress}
        />

        <View className="mt-section rounded-card border border-border bg-surface px-4">
          {CUSTOMER_DOCUMENT_DEFINITIONS.map((document, index) => (
            <DocumentRequirementRow
              definition={document}
              hasDraft={hasDocumentDraft(document.id, customer.documents)}
              isLast={index === CUSTOMER_DOCUMENT_DEFINITIONS.length - 1}
              key={document.id}
              onPress={() => {
                if (!accepted) {
                  toast.showToast('Agree to the document privacy notice before opening your documents.', 'warning', 'Agreement required');
                  return;
                }
                router.push(
                  `/profile/documents/${document.id}${isOnboardingFlow ? '?source=onboarding' : ''}` as Href,
                );
              }}
              status={customer.documentStatuses[document.id]}
            />
          ))}
        </View>
      </OnboardingScreenFrame>
      <FormToast message={toast.message} onDismiss={toast.clearToast} title={toast.title} variant={toast.variant} />
    </View>
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
        navigationTitle="Documents"
        subtitle="The selected document type is not available."
        title="Document not found"
      />
    </OnboardingScreenFrame>
  );
}
