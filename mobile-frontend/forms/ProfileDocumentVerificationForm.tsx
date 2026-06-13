import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import {
  CheckCircle2,
  Clock3,
  RotateCcw,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingScreenFrame } from '@/components/onboarding/OnboardingScreenFrame';
import { UploadDocumentCard } from '@/components/onboarding/UploadDocumentCard';
import { DocumentReviewBadge } from '@/components/profile';
import { BottomActionButton } from '@/components/ui/BottomActionButton';
import { DatePickerInput, getRelativeDateKey } from '@/components/ui/DatePickerInput';
import { FormInput } from '@/components/ui/FormInput';
import { FormToast, useFormToast } from '@/forms/FormToast';
import {
  validateCustomerDocument,
  type DocumentVerificationField,
  type FieldErrors,
} from '@/forms/validation';
import { getCustomerDocumentDefinition } from '@/lib/customer/document-verification';
import {
  saveCustomerDocumentDraft,
  submitCustomerDocument,
  useCustomer,
} from '@/lib/customer/customer-store';
import { uploadCustomerDocument } from '@/services/api';
import type { DocumentImagePickError } from '@/lib/customer/image-picker';
import type {
  CustomerDocumentId,
  CustomerDocumentUploads,
} from '@/types/customer';
import { useAuth } from '@/providers/AuthProvider';

const IMAGE_HELPER = 'Use a clear, visible, well-lit image. Maximum file size is 5 MB.';

function clearPreviousDocumentImages(
  documentId: CustomerDocumentId,
  documents: CustomerDocumentUploads,
) {
  const clearServerImage = (value: string) => (
    /^https?:\/\//i.test(value) ? '' : value
  );

  if (documentId === 'driver-license') {
    return {
      ...documents,
      driverLicenseFront: clearServerImage(documents.driverLicenseFront),
      driverLicenseBack: clearServerImage(documents.driverLicenseBack),
    };
  }

  if (documentId === 'passport') {
    return { ...documents, passport: clearServerImage(documents.passport) };
  }

  return {
    ...documents,
    proofOfAddress: clearServerImage(documents.proofOfAddress),
  };
}

function ReviewStateNotice({
  rejectionReason,
  status,
}: {
  status: 'pending-review' | 'verified' | 'rejected';
  rejectionReason?: string;
}) {
  const isVerified = status === 'verified';
  const isRejected = status === 'rejected';
  const Icon = isVerified ? CheckCircle2 : isRejected ? RotateCcw : Clock3;
  const iconColor = isVerified ? '#047857' : isRejected ? '#DC2626' : '#C2410C';
  const background = isVerified
    ? 'bg-[#ECFDF5] border-[#BBF7D0]'
    : isRejected
      ? 'bg-[#FEF2F2] border-[#FECACA]'
      : 'bg-[#FFF7ED] border-[#FED7AA]';
  const title = isVerified
    ? 'Document verified'
    : isRejected
      ? 'Document needs an update'
      : 'Document pending review';
  const message = isVerified
    ? 'This document has been approved and can no longer be changed.'
    : isRejected
      ? `Your previous submission was not accepted. ${rejectionReason ? `Reason: ${rejectionReason} ` : ''}Upload corrected document images and submit again.`
      : 'Your upload is locked while Jamjade reviews the submitted document.';

  return (
    <View className={`mt-6 flex-row items-start gap-3 rounded-[24px] border p-4 ${background}`}>
      <View className="h-10 w-10 items-center justify-center rounded-full bg-white">
        <Icon size={20} color={iconColor} strokeWidth={2.45} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] font-black text-[#17315F]">{title}</Text>
        <Text className="mt-1 text-[12px] font-semibold leading-5 text-[#6C7A96]">{message}</Text>
      </View>
      <DocumentReviewBadge status={status} />
    </View>
  );
}

export function ProfileDocumentVerificationForm({
  documentId,
  isOnboardingFlow = false,
}: {
  documentId: CustomerDocumentId;
  isOnboardingFlow?: boolean;
}) {
  const router = useRouter();
  const customer = useCustomer();
  const { refreshProfile } = useAuth();
  const definition = getCustomerDocumentDefinition(documentId);
  const status = customer.documentStatuses[documentId];
  const isLocked = status === 'pending-review' || status === 'verified';
  const [form, setForm] = useState<CustomerDocumentUploads>(customer.documents);
  const [errors, setErrors] = useState<FieldErrors<DocumentVerificationField>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useFormToast();

  useFocusEffect(
    useCallback(() => {
      void refreshProfile().catch(() => undefined);
    }, [refreshProfile]),
  );

  useEffect(() => {
    if (status === 'rejected') {
      setForm((currentForm) => clearPreviousDocumentImages(documentId, currentForm));
    }
  }, [documentId, status]);

  if (!definition) {
    return null;
  }

  const updateForm = (key: keyof CustomerDocumentUploads, value: string | boolean) => {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      [key as DocumentVerificationField]: '',
    }));
  };

  const handlePickError = (error: DocumentImagePickError) => {
    if (error === 'too-large') {
      toast.showToast('The selected image is larger than the 5 MB limit.');
      return;
    }

    if (error === 'permission-denied') {
      toast.showToast('Allow photo access to choose a document image.');
      return;
    }

    toast.showToast('Unable to open your gallery. Please try again.');
  };

  const handleSubmit = async () => {
    const validation = validateCustomerDocument(documentId, form);
    setErrors(validation.errors);

    if (!validation.isValid) {
      toast.showToast('Please complete all required fields and document images.');
      return;
    }

    setIsSubmitting(true);

    try {
      const submittedDocument = await uploadCustomerDocument(documentId, form);
      submitCustomerDocument(documentId, form, submittedDocument);
      router.replace(
        `/profile/documents${isOnboardingFlow ? '?source=onboarding' : ''}` as Href,
      );
    } catch {
      toast.showToast('The document could not be submitted. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveLater = () => {
    saveCustomerDocumentDraft(documentId, form);
    router.replace(
      `/profile/documents${isOnboardingFlow ? '?source=onboarding' : ''}` as Href,
    );
  };

  const renderUploadCard = (
    key: keyof CustomerDocumentUploads,
    label: string,
  ) => (
    <UploadDocumentCard
      disabled={isLocked}
      error={errors[key as DocumentVerificationField]}
      helperText={IMAGE_HELPER}
      label={label}
      onChange={(value) => updateForm(key, value)}
      onPickError={handlePickError}
      required
      value={String(form[key])}
    />
  );

  return (
    <View className="flex-1">
      <OnboardingScreenFrame
        action={
          <BottomActionButton
            disabled={isLocked || isSubmitting}
            label={
              isSubmitting
                ? 'Submitting...'
                : status === 'verified'
                ? 'Document Verified'
                : status === 'pending-review'
                  ? 'Pending Review'
                  : status === 'rejected'
                    ? 'Submit Corrected Document'
                  : 'Submit Documents'
            }
            onPress={handleSubmit}
            onSecondaryPress={isLocked ? undefined : handleSaveLater}
            secondaryLabel={isLocked ? undefined : 'Save and Continue Later'}
          />
        }>
        <OnboardingHeader
          navigationTitle="Document Verification"
          onBackPress={
            isOnboardingFlow
              ? () => router.replace('/profile/documents?source=onboarding' as Href)
              : undefined
          }
          subtitle={definition.uploadDescription}
          title={definition.name}
        />

        {status !== 'not-submitted' ? (
          <ReviewStateNotice
            rejectionReason={customer.documentRejectionReasons[documentId]}
            status={status}
          />
        ) : null}

        <View className="mt-6 gap-4">
          {documentId === 'driver-license' ? (
            <>
              <View className="rounded-[28px] border border-[#E6EEFF] bg-white p-4 shadow-md shadow-[#17315F]/5">
                <FormInput
                  autoCapitalize="characters"
                  editable={!isLocked}
                  error={errors.driverLicenseNumber}
                  icon="credit-card"
                  label="Driver's License Number"
                  onChangeText={(value) => updateForm('driverLicenseNumber', value)}
                  placeholder="Enter license number"
                  required
                  value={form.driverLicenseNumber}
                />
                <DatePickerInput
                  disabled={isLocked}
                  error={errors.driverLicenseExpirationDate}
                  initialVisibleDate={getRelativeDateKey(365)}
                  label="Driver's License Expiration Date"
                  minimumDate={getRelativeDateKey(1)}
                  onChange={(value) => updateForm('driverLicenseExpirationDate', value)}
                  placeholder="Select expiration date"
                  required
                  value={form.driverLicenseExpirationDate}
                />
              </View>
              {renderUploadCard('driverLicenseFront', "Driver's License Front")}
              {renderUploadCard('driverLicenseBack', "Driver's License Back")}
            </>
          ) : null}

          {documentId === 'passport'
            ? renderUploadCard('passport', 'Passport Information Page')
            : null}

          {documentId === 'proof-of-address'
            ? renderUploadCard('proofOfAddress', 'Meralco Bill / Proof of Address')
            : null}
        </View>
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
