import { themeColors } from '@/constants/theme';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import { ImageIcon, LockKeyhole, ShieldCheck } from 'lucide-react-native';
import { useCallback } from 'react';
import { Text, View } from 'react-native';

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
    <OnboardingScreenFrame>
      <View className="mt-6 overflow-hidden rounded-card border border-border bg-background">
        <View className="flex-row items-center gap-3 border-b border-border bg-muted px-4 py-3.5">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-surface">
            <ShieldCheck size={19} color={themeColors.primary} strokeWidth={2.45} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="font-sans text-[14px] font-semibold text-foreground">Before you upload</Text>
            <Text className="font-sans mt-0.5 text-[11px] font-normal leading-4 text-secondary-foreground">
              Follow these reminders to avoid verification delays.
            </Text>
          </View>
        </View>
        <View className="gap-3 px-4 py-4">
          <View className="flex-row items-start gap-3">
            <ImageIcon size={18} color={themeColors.primary} strokeWidth={2.4} />
            <Text className="font-sans min-w-0 flex-1 text-[12px] font-normal leading-5 text-secondary-foreground">
              Use a clear, visible, well-lit image. Each image must be 5 MB or smaller.
            </Text>
          </View>
          <View className="flex-row items-start gap-3">
            <LockKeyhole size={18} color={themeColors.success} strokeWidth={2.4} />
            <Text className="font-sans min-w-0 flex-1 text-[12px] font-normal leading-5 text-secondary-foreground">
              Pending and verified documents stay locked. Rejected documents can be corrected and uploaded
              again.
            </Text>
          </View>
        </View>
      </View>

      <View className="mt-5 rounded-card border border-border bg-surface px-4 ">
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
