import { themeColors } from '@/constants/theme';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';

import { OnboardingScreenFrame } from '@/components/onboarding/OnboardingScreenFrame';
import { UploadDocumentCard } from '@/components/onboarding/UploadDocumentCard';
import { DocumentReviewBadge } from '@/components/profile';
import { DocumentPrivacyNotice, useDocumentPrivacyAgreement, DOCUMENT_PRIVACY_VERSION } from '@/components/profile/DocumentPrivacyNotice';
import { BottomActionButton } from '@/components/ui/BottomActionButton';
import { DatePickerInput, getRelativeDateKey } from '@/components/ui/DatePickerInput';
import { FormInput } from '@/components/ui/FormInput';
import { FormToast, useFormToast } from '@/forms/shared/FormToast';
import { getCustomerDocumentSchema } from '@/validation';
import { getCustomerDocumentDefinition } from '@/lib/customer/document-verification';
import { formatDriverLicenseNumber } from '@/lib/customer/driver-license';
import {
  saveCustomerDocumentDraft,
  submitCustomerDocument,
  useCustomer,
} from '@/lib/customer/customer-store';
import { uploadCustomerDocument } from '@/services/api';
import { ApiError } from '@/services/http';
import type { DocumentImagePickError } from '@/lib/customer/image-picker';
import type { CustomerDocumentId, CustomerDocumentUploads } from '@/types/customer';
import { useAuth } from '@/providers/AuthProvider';

function clearPreviousDocumentImages(documentId: CustomerDocumentId, documents: CustomerDocumentUploads) {
  const clearServerImage = (value: string) => (/^https?:\/\//i.test(value) ? '' : value);

  if (documentId === 'driver-license') {
    return {
      ...documents,
      driverLicenseFront: clearServerImage(documents.driverLicenseFront),
      driverLicenseBack: clearServerImage(documents.driverLicenseBack),
    };
  }

  return {
    ...documents,
    proofOfAddress: clearServerImage(documents.proofOfAddress),
    proofOfAddressBack: clearServerImage(documents.proofOfAddressBack),
  };
}

export function ProfileDocumentVerificationForm({
  documentId,
  isOnboardingFlow = false,
}: {
  documentId: CustomerDocumentId;
  isOnboardingFlow?: boolean;
}) {
  const router = useRouter();
  const { accepted } = useDocumentPrivacyAgreement();
  const customer = useCustomer();
  const { refreshProfile } = useAuth();
  const definition = getCustomerDocumentDefinition(documentId);
  const status = customer.documentStatuses[documentId];
  const rejectionReason = status === 'rejected' ? customer.documentRejectionReasons[documentId] : undefined;
  const [isEditingVerified, setIsEditingVerified] = useState(false);
  const isLocked = status === 'pending-review' || (status === 'verified' && !isEditingVerified);
  const toast = useFormToast();
  const documentSchema = useMemo(() => getCustomerDocumentSchema(documentId), [documentId]);
  const {
    control,
    formState: { errors, isDirty, isSubmitting },
    getValues,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
  } = useForm<CustomerDocumentUploads>({
    defaultValues: customer.documents,
    resolver: zodResolver(documentSchema),
  });
  const form = watch();

  useFocusEffect(
    useCallback(() => {
      void refreshProfile().catch(() => undefined);
    }, [refreshProfile]),
  );

  useEffect(() => {
    if (!isDirty && !isEditingVerified) {
      reset(status === 'rejected'
        ? clearPreviousDocumentImages(documentId, customer.documents)
        : customer.documents);
    }
  }, [customer.documents, documentId, isDirty, isEditingVerified, reset, status]);

  if (!definition) {
    return null;
  }

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

  const onSubmit = async (values: CustomerDocumentUploads) => {
    if (!accepted) return;
    try {
      const submittedDocument = await uploadCustomerDocument(documentId, values, DOCUMENT_PRIVACY_VERSION);
      submitCustomerDocument(documentId, values, submittedDocument);
      router.replace(`/profile/documents${isOnboardingFlow ? '?source=onboarding' : ''}` as Href);
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        const fieldMap: Record<string, keyof CustomerDocumentUploads> = {
          back_file: documentId === 'driver-license' ? 'driverLicenseBack' : 'proofOfAddressBack',
          document_number: 'driverLicenseNumber',
          expires_at: 'driverLicenseExpirationDate',
          file: 'proofOfAddress',
          front_file: 'driverLicenseFront',
        };

        Object.entries(error.errors).forEach(([serverField, messages]) => {
          const field = fieldMap[serverField];
          const message = messages[0];

          if (field && message) {
            setError(field, { message, type: 'server' });
          }
        });
      }

      toast.showToast('The document could not be submitted. Please try again.');
    }
  };

  const handleSaveLater = () => {
    saveCustomerDocumentDraft(documentId, getValues());
    router.replace(`/profile/documents${isOnboardingFlow ? '?source=onboarding' : ''}` as Href);
  };

  const beginVerifiedEdit = () => {
    reset(clearPreviousDocumentImages(documentId, customer.documents));
    setIsEditingVerified(true);
  };

  const cancelVerifiedEdit = () => {
    reset(customer.documents);
    setIsEditingVerified(false);
  };

  const renderUploadCard = (key: keyof CustomerDocumentUploads, label: string, required = true) => (
    <UploadDocumentCard
      allowPreview
      disabled={isLocked || isSubmitting}
      error={errors[key]?.message}
      helperText={key === 'proofOfAddress'
        ? 'Use a clear, recent bill or official document showing your name and current address. Maximum 5 MB.'
        : undefined}
      isUploading={isSubmitting}
      label={label}
      onChange={(value) => {
        setValue(key, value, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }}
      onPickError={handlePickError}
      required={required}
      value={String(form[key])}
    />
  );

  return (
    <View className="flex-1">
      <OnboardingScreenFrame
        action={status === 'verified' && !isEditingVerified ? (
          <BottomActionButton label="Edit & resubmit" onPress={beginVerifiedEdit} />
        ) : isLocked ? undefined :
          <BottomActionButton
            disabled={isLocked || isSubmitting || !accepted}
            secondaryDisabled={isSubmitting}
            footer={<DocumentPrivacyNotice />}
            label={
              isSubmitting
                ? 'Submitting...'
                : status === 'verified'
                  ? 'Resubmit document'
                  : status === 'rejected'
                      ? 'Submit Corrected Document'
                      : 'Submit Documents'
            }
            onPress={handleSubmit(onSubmit, () => {
              toast.showToast('Please complete all required fields and document images.');
            })}
            onSecondaryPress={isSubmitting ? undefined : isEditingVerified ? cancelVerifiedEdit : handleSaveLater}
            secondaryLabel={isSubmitting ? undefined : isEditingVerified ? 'Cancel' : 'Save and Continue Later'}
          />
        }>
        <View className="min-h-12 flex-row items-center justify-between gap-3 border-b border-border pb-3">
          <Pressable accessibilityRole="button" accessibilityLabel="Go back"
            onPress={() => isOnboardingFlow
              ? router.replace('/profile/documents?source=onboarding' as Href)
              : router.back()}
            className="h-11 w-11 items-center justify-center">
            <ArrowLeft size={21} color={themeColors.foreground} strokeWidth={2} />
          </Pressable>
          <Text accessibilityRole="header" numberOfLines={1} className="font-sans min-w-0 flex-1 text-[19px] font-semibold text-foreground">{definition.name}</Text>
          <DocumentReviewBadge status={status} />
        </View>
        {isEditingVerified ? <Text className="font-sans mt-3 text-caption leading-5 text-secondary-foreground">
          Upload new images. Resubmitting pauses self-drive eligibility until approval.
        </Text> : null}

        <View className="mt-section gap-4">
          {rejectionReason ? (
            <Text className="font-sans text-caption text-destructive">{rejectionReason}</Text>
          ) : null}
          {documentId === 'driver-license' ? (
            <>
              <View className="rounded-card border border-border bg-surface p-4">
                <Controller
                  control={control}
                  name="driverLicenseNumber"
                  render={({ field, fieldState }) => (
                    <FormInput
                      autoCapitalize="characters"
                      editable={!isLocked && !isSubmitting}
                      error={fieldState.error?.message}
                      icon="credit-card"
                      label="Driver's License Number"
                      maxLength={13}
                      onBlur={field.onBlur}
                      onChangeText={(value) => field.onChange(formatDriverLicenseNumber(value))}
                      placeholder="N03-12-123456"
                      required
                      value={field.value}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="driverLicenseExpirationDate"
                  render={({ field, fieldState }) => (
                    <DatePickerInput
                      disabled={isLocked || isSubmitting}
                      error={fieldState.error?.message}
                      initialVisibleDate={getRelativeDateKey(365)}
                      label="Driver's License Expiration Date"
                      minimumDate={getRelativeDateKey(1)}
                      onChange={field.onChange}
                      placeholder="Select expiration date"
                      required
                      value={field.value}
                    />
                  )}
                />
              </View>
              {renderUploadCard('driverLicenseFront', "Driver's License Front")}
              {renderUploadCard('driverLicenseBack', "Driver's License Back")}
            </>
          ) : null}

          {documentId === 'proof-of-address' ? (
            <>
              {renderUploadCard('proofOfAddress', 'Proof of Address Front')}
              {renderUploadCard('proofOfAddressBack', 'Proof of Address Back', false)}
            </>
          ) : null}
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
