import { useRouter, type Href } from 'expo-router';
import { CheckCircle2, FileCheck2 } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingScreenFrame } from '@/components/onboarding/OnboardingScreenFrame';
import { UploadDocumentCard } from '@/components/onboarding/UploadDocumentCard';
import { BottomActionButton } from '@/components/ui/BottomActionButton';
import { DatePickerInput, getRelativeDateKey } from '@/components/ui/DatePickerInput';
import { FormInput } from '@/components/ui/FormInput';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  saveDocumentVerificationDraft,
  submitDocumentVerification,
  useCustomer,
} from '@/lib/customer/customer-store';
import type { CustomerDocumentUploads } from '@/types/customer';
import {
  hasErrors,
  validateDocumentVerification,
  type DocumentVerificationField,
  type FieldErrors,
} from '@/utils/validation';

export default function DocumentVerificationScreen() {
  const router = useRouter();
  const customer = useCustomer();
  const [form, setForm] = useState<CustomerDocumentUploads>(customer.documents);
  const [errors, setErrors] = useState<FieldErrors<DocumentVerificationField>>({});
  const [isSubmitted, setIsSubmitted] = useState(customer.documentVerificationStatus === 'pending-review');

  const updateForm = (key: keyof CustomerDocumentUploads, value: string | boolean) => {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [key]: '' }));
  };

  const handleSubmit = () => {
    const nextErrors = validateDocumentVerification(form);
    setErrors(nextErrors);

    if (hasErrors(nextErrors)) {
      return;
    }

    submitDocumentVerification(form);
    setIsSubmitted(true);
  };

  const handleSaveLater = () => {
    saveDocumentVerificationDraft(form);
    router.replace('/(tabs)' as Href);
  };

  if (isSubmitted) {
    return (
      <OnboardingScreenFrame
        action={
          <BottomActionButton
            label="Continue to App"
            onPress={() => router.replace('/(tabs)' as Href)}
          />
        }>
        <View className="min-h-[620px] justify-center">
          <View className="items-center">
            <View className="h-[104px] w-[104px] items-center justify-center rounded-full bg-[#ECFDF5]">
              <CheckCircle2 size={54} color="#047857" strokeWidth={2.4} />
            </View>
            <Text className="mt-8 text-center text-[30px] font-black leading-[35px] text-[#17315F]">
              Your documents have been submitted for review.
            </Text>
            <Text className="mt-3 text-center text-[14px] font-semibold leading-6 text-[#6C7A96]">
              Status is now Pending Review. Admin will review your documents later before self-drive is enabled.
            </Text>
            <View className="mt-5">
              <StatusBadge status="pending" />
            </View>
          </View>
        </View>
      </OnboardingScreenFrame>
    );
  }

  return (
    <OnboardingScreenFrame
      action={
        <BottomActionButton
          label="Submit Documents"
          onPress={handleSubmit}
          secondaryLabel="Save and Continue Later"
          onSecondaryPress={handleSaveLater}
        />
      }>
      <OnboardingHeader
        currentStep={4}
        icon={FileCheck2}
        subtitle="Upload clear images. Submission starts admin review and does not instantly mark you as verified."
        title="Document verification"
        totalSteps={4}
      />

      <View className="mt-7 gap-4">
        <View className="gap-4 rounded-[28px] border border-[#E6EEFF] bg-white p-4 shadow-md shadow-[#17315F]/5">
          <FormInput
            autoCapitalize="characters"
            error={errors.driverLicenseNumber}
            icon="credit-card"
            label="Driver's License Number"
            onChangeText={(value) => updateForm('driverLicenseNumber', value)}
            placeholder="Enter license number"
            required
            value={form.driverLicenseNumber}
          />
          <DatePickerInput
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

        <UploadDocumentCard
          error={errors.driverLicenseFront}
          helperText="Front side must be readable."
          label="Upload Driver's License Front"
          onChange={(value) => updateForm('driverLicenseFront', value)}
          required
          value={form.driverLicenseFront}
        />
        <UploadDocumentCard
          error={errors.driverLicenseBack}
          helperText="Back side must show restrictions and barcode if present."
          label="Upload Driver's License Back"
          onChange={(value) => updateForm('driverLicenseBack', value)}
          required
          value={form.driverLicenseBack}
        />
        <UploadDocumentCard
          error={errors.validId}
          helperText="Use a clear government-issued ID."
          label="Upload Valid ID"
          onChange={(value) => updateForm('validId', value)}
          required
          value={form.validId}
        />
        <UploadDocumentCard
          error={errors.proofOfAddress}
          helperText="Recent utility bill, proof of billing, or Meralco bill."
          label="Upload Proof of Address / Meralco Bill"
          onChange={(value) => updateForm('proofOfAddress', value)}
          required
          value={form.proofOfAddress}
        />
        <UploadDocumentCard
          error={errors.passport}
          helperText={form.passportRequiredByAdmin ? 'Required by admin for this account.' : 'Optional supporting document.'}
          label="Upload Passport"
          onChange={(value) => updateForm('passport', value)}
          required={form.passportRequiredByAdmin}
          value={form.passport}
        />
      </View>
    </OnboardingScreenFrame>
  );
}
