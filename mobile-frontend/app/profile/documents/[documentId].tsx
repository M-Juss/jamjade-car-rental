import { useLocalSearchParams } from 'expo-router';

import { ProfileDocumentVerificationForm } from '@/forms/ProfileDocumentVerificationForm';
import { isCustomerDocumentId } from '@/lib/customer/document-verification';
import { InvalidDocumentScreen } from '@/screens/profile/DocumentVerificationListScreen';

export default function DocumentUploadRoute() {
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

  return (
    <ProfileDocumentVerificationForm
      documentId={documentId}
      isOnboardingFlow={source === 'onboarding'}
    />
  );
}
