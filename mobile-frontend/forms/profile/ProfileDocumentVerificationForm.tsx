import { zodResolver } from '@hookform/resolvers/zod';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import {
  CheckCircle2,
  Clock3,
  RotateCcw,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, View } from 'react-native';

import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingScreenFrame } from '@/components/onboarding/OnboardingScreenFrame';
import { UploadDocumentCard } from '@/components/onboarding/UploadDocumentCard';
import { DocumentReviewBadge } from '@/components/profile';
import { BottomActionButton } from '@/components/ui/BottomActionButton';
import { DatePickerInput, getRelativeDateKey } from '@/components/ui/DatePickerInput';
import { FormInput } from '@/components/ui/FormInput';
import { FormToast, useFormToast } from '@/forms/shared/FormToast';
import { getCustomerDocumentSchema } from '@/validation';
import { getCustomerDocumentDefinition } from '@/lib/customer/document-verification';
import {
  saveCustomerDocumentDraft,
  submitCustomerDocument,
  useCustomer,
} from '@/lib/customer/customer-store';
import { uploadCustomerDocument } from '@/services/api';
import { ApiError } from '@/services/http';
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
    ? 'bg-success-surface border-success-border'
    : isRejected
      ? 'bg-destructive-surface border-destructive-border'
      : 'bg-warning-surface border-warning-border';
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
      <View className="h-10 w-10 items-center justify-center rounded-full bg-surface">
        <Icon size={20} color={iconColor} strokeWidth={2.45} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] font-black text-foreground">{title}</Text>
        <Text className="mt-1 text-[12px] font-semibold leading-5 text-muted-foreground">{message}</Text>
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
  const toast = useFormToast();
  const documentSchema = useMemo(
    () => getCustomerDocumentSchema(documentId),
    [documentId],
  );
  const {
    control,
    formState: { errors, isSubmitting },
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
    if (status === 'rejected') {
      reset(clearPreviousDocumentImages(documentId, getValues()));
    }
  }, [documentId, getValues, reset, status]);

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
    try {
      const submittedDocument = await uploadCustomerDocument(documentId, values);
      submitCustomerDocument(documentId, values, submittedDocument);
      router.replace(
        `/profile/documents${isOnboardingFlow ? '?source=onboarding' : ''}` as Href,
      );
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        const singleFileField =
          documentId === 'passport' ? 'passport' : 'proofOfAddress';
        const fieldMap: Record<string, keyof CustomerDocumentUploads> = {
          back_file: 'driverLicenseBack',
          document_number: 'driverLicenseNumber',
          expires_at: 'driverLicenseExpirationDate',
          file: singleFileField,
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
      error={errors[key]?.message}
      helperText={IMAGE_HELPER}
      label={label}
      onChange={(value) => {
        setValue(key, value, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }}
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
            onPress={handleSubmit(onSubmit, () => {
              toast.showToast('Please complete all required fields and document images.');
            })}
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
              <View className="rounded-[28px] border border-border bg-surface p-4 shadow-md shadow-foreground/5">
                <Controller
                  control={control}
                  name="driverLicenseNumber"
                  render={({ field, fieldState }) => (
                    <FormInput
                      autoCapitalize="characters"
                      editable={!isLocked}
                      error={fieldState.error?.message}
                      icon="credit-card"
                      label="Driver's License Number"
                      maxLength={100}
                      onBlur={field.onBlur}
                      onChangeText={field.onChange}
                      placeholder="Enter license number"
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
                      disabled={isLocked}
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
