import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import { ImageIcon, LockKeyhole, ShieldCheck } from 'lucide-react-native';
import { useCallback } from 'react';
import { Text, View } from 'react-native';

import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingScreenFrame } from '@/components/onboarding/OnboardingScreenFrame';
import { DocumentRequirementRow } from '@/components/profile';
import { BottomActionButton } from '@/components/ui/BottomActionButton';
import {
  CUSTOMER_DOCUMENT_DEFINITIONS,
  hasDocumentDraft,
} from '@/lib/customer/document-verification';
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
    <OnboardingScreenFrame>
      <OnboardingHeader
        navigationTitle="Document Verification"
        onBackPress={onBackPress}
        subtitle="Choose a required document to upload or review. Each document is submitted separately."
        title="Required documents"
      />

      <View className="mt-6 overflow-hidden rounded-[26px] border border-[#D6E5FF] bg-background">
        <View className="flex-row items-center gap-3 border-b border-[#DCE8FF] bg-muted px-4 py-3.5">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-surface">
            <ShieldCheck size={19} color="#346EF6" strokeWidth={2.45} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[14px] font-black text-foreground">Before you upload</Text>
            <Text className="mt-0.5 text-[11px] font-semibold leading-4 text-muted-foreground">
              Follow these reminders to avoid verification delays.
            </Text>
          </View>
        </View>
        <View className="gap-3 px-4 py-4">
          <View className="flex-row items-start gap-3">
            <ImageIcon size={18} color="#346EF6" strokeWidth={2.4} />
            <Text className="min-w-0 flex-1 text-[12px] font-semibold leading-5 text-[#5E6E8C]">
              Use a clear, visible, well-lit image. Each image must be 5 MB or smaller.
            </Text>
          </View>
          <View className="flex-row items-start gap-3">
            <LockKeyhole size={18} color="#047857" strokeWidth={2.4} />
            <Text className="min-w-0 flex-1 text-[12px] font-semibold leading-5 text-[#5E6E8C]">
              Pending and verified documents stay locked. Rejected documents can be corrected and uploaded again.
            </Text>
          </View>
        </View>
      </View>

      <View className="mt-5 rounded-[28px] border border-border bg-surface px-4 shadow-md shadow-foreground/5">
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
