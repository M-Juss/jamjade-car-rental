import { useRouter, type Href } from 'expo-router';
import { PhoneCall } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingScreenFrame } from '@/components/onboarding/OnboardingScreenFrame';
import { BottomActionButton } from '@/components/ui/BottomActionButton';
import { FormInput } from '@/components/ui/FormInput';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { FormToast, useFormToast } from '@/forms/FormToast';
import {
  validateEmergencyContact,
  sanitizePersonName,
  type EmergencyContactField,
  type FieldErrors,
} from '@/forms/validation';
import {
  skipEmergencyContact,
  finalizeCustomerProfileSetup,
  updateDrivingIntent,
  updateEmergencyContact,
  useCustomer,
} from '@/lib/customer/customer-store';
import type { EmergencyContact, EmergencyRelationship } from '@/types/customer';
import {
  completeProfile,
  saveEmergencyContact,
  skipEmergencyContact as skipEmergencyContactApi,
} from '@/services/api';
import { ApiError } from '@/services/http';

const relationshipOptions: Exclude<EmergencyRelationship, ''>[] = [
  'Parent',
  'Sibling',
  'Spouse',
  'Guardian',
  'Friend',
  'Other',
];

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function EmergencyContactForm() {
  const router = useRouter();
  const customer = useCustomer();
  const [contact, setContact] = useState<EmergencyContact>(customer.emergencyContact);
  const [errors, setErrors] = useState<FieldErrors<EmergencyContactField>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useFormToast();

  const goToNextStep = async () => {
    if (customer.isBelow18) {
      await completeProfile({ drivingIntent: 'owner_driver' });
      updateDrivingIntent('owner-driver');
      finalizeCustomerProfileSetup();
      router.push('/onboarding/age-restriction' as Href);
      return;
    }

    router.push('/onboarding/driving-intent' as Href);
  };

  const updateContact = (key: keyof EmergencyContact, value: string) => {
    setContact((currentContact) => ({ ...currentContact, [key]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [key]: '' }));
  };

  const handleContinue = async () => {
    if (isSubmitting) {
      return;
    }

    const validation = validateEmergencyContact(contact);
    setErrors(validation.errors);

    if (!validation.data) {
      toast.showToast('Complete all required emergency contact fields.');
      return;
    }

    setIsSubmitting(true);

    try {
      await saveEmergencyContact(validation.data);
      updateEmergencyContact(validation.data);
      await goToNextStep();
    } catch (error) {
      toast.showToast(
        error instanceof ApiError && error.status === 0
          ? 'Unable to connect right now. Please try again.'
          : 'Unable to save the emergency contact.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      await skipEmergencyContactApi();
      skipEmergencyContact();
      await goToNextStep();
    } catch (error) {
      toast.showToast(
        error instanceof ApiError && error.status === 0
          ? 'Unable to connect right now. Please try again.'
          : 'Unable to skip this step right now.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1">
      <OnboardingScreenFrame
        action={
          <BottomActionButton
            disabled={isSubmitting}
            label={isSubmitting ? 'Saving...' : 'Continue'}
            onPress={handleContinue}
            secondaryLabel="Skip for now"
            onSecondaryPress={handleSkip}
          />
        }>
        <OnboardingHeader
          currentStep={2}
          icon={PhoneCall}
          subtitle="Complete all fields to save an emergency contact, or skip for now and add one later from your profile."
          title="Emergency contact"
          totalSteps={3}
        />

        <View className="mt-7 gap-4 rounded-[28px] border border-[#E6EEFF] bg-white p-4 shadow-md shadow-[#17315F]/5">
          <FormInput
            autoCapitalize="words"
            error={errors.name}
            icon="person-outline"
            label="Emergency Contact Name"
            maxLength={100}
            onChangeText={(value) => updateContact('name', sanitizePersonName(value))}
            placeholder="Full name"
            required
            value={contact.name}
          />
          <PhoneInput
            error={errors.contactNumber}
            label="Emergency Contact Number"
            onChangeText={(value) => updateContact('contactNumber', value)}
            placeholder="09XX XXX XXXX"
            required
            value={contact.contactNumber}
          />
          <View className="relative mb-8 gap-2">
            <Text className="text-[12px] font-black text-[#6C7A96]">
              Relationship <Text className="text-[#E5484D]">*</Text>
            </Text>
            <View className="flex-row flex-wrap gap-2.5">
              {relationshipOptions.map((relationship) => {
                const isSelected = contact.relationship === relationship;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    key={relationship}
                    onPress={() => updateContact('relationship', relationship)}
                    className={cx(
                      'min-h-[42px] items-center justify-center rounded-full border px-4',
                      isSelected ? 'border-[#346EF6] bg-[#EEF4FF]' : 'border-[#E6EEFF] bg-[#F8FAFF]',
                    )}>
                    <Text className={cx('text-[13px] font-black', isSelected ? 'text-[#346EF6]' : 'text-[#17315F]')}>
                      {relationship}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View className="absolute left-1 right-1 top-full mt-1.5">
              {errors.relationship ? (
                <Text className="text-[11px] font-bold leading-4 text-[#D92D20]">{errors.relationship}</Text>
              ) : (
                <Text className="text-[11px] font-bold leading-4 text-[#91A0B8]">
                  Select your relationship to the emergency contact.
                </Text>
              )}
            </View>
          </View>
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
