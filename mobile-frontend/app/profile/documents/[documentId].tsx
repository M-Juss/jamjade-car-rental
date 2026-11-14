import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

import { useDocumentPrivacyAgreement } from '@/components/profile/DocumentPrivacyNotice';
import { ProfileDocumentVerificationForm } from '@/forms/profile/ProfileDocumentVerificationForm';
import { isCustomerDocumentId } from '@/lib/customer/document-verification';
import { InvalidDocumentScreen } from '@/screens/profile/DocumentVerificationListScreen';

export default function DocumentUploadRoute() {
  const { accepted } = useDocumentPrivacyAgreement();
  const params = useLocalSearchParams<{
    documentId?: string | string[];
    source?: string | string[];
  }>();
  const documentId = Array.isArray(params.documentId)
    ? params.documentId[0]
    : params.documentId;
  const source = Array.isArray(params.source) ? params.source[0] : params.source;

  if (!documentId || !isCustomerDocumentId(documentId)) {
    return <InvalidDocumentScreen />;
  }

  if (!accepted) {
    return <Redirect href={`/profile/documents${source === 'onboarding' ? '?source=onboarding' : ''}` as Href} />;
  }

  return (
    <ProfileDocumentVerificationForm
      documentId={documentId}
      isOnboardingFlow={source === 'onboarding'}
    />
  );
}
