import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AvatarUploader } from '@/components/onboarding/AvatarUploader';
import { ProfileFormSheet } from '@/components/profile';
import { DatePickerInput, getTodayDateKey } from '@/components/ui/DatePickerInput';
import { FormInput } from '@/components/ui/FormInput';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { FormToast, useFormToast } from '@/forms/FormToast';
import {
  validateBasicInfo,
  sanitizePersonName,
  type BasicInfoField,
  type FieldErrors,
} from '@/forms/validation';
import {
  createCustomerProfile,
  getCustomerInitials,
} from '@/lib/customer/customer-store';
import type {
  BasicCustomerProfileInput,
  Customer,
} from '@/types/customer';
import { updateProfile } from '@/services/api';
import { ApiError } from '@/services/http';

function getFormValues(customer: Customer): BasicCustomerProfileInput {
  return {
    address: customer.address,
    birthdate: customer.birthdate,
    contactNumber: customer.contactNumber,
    firstName: customer.firstName,
    lastName: customer.lastName,
    profilePicture: customer.profilePicture,
  };
}

export function ProfilePersonalInformationForm({
  customer,
  onClose,
  visible,
}: {
  customer: Customer;
  visible: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState<BasicCustomerProfileInput>(() => getFormValues(customer));
  const [errors, setErrors] = useState<FieldErrors<BasicInfoField>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { clearToast, message, showToast, title, variant } = useFormToast();
  const initials =
    [form.firstName, form.lastName]
      .filter(Boolean)
      .map((name) => name[0])
      .join('')
      .toUpperCase() || getCustomerInitials(customer);

  useEffect(() => {
    if (visible) {
      setForm(getFormValues(customer));
      setErrors({});
      clearToast();
    }
  }, [clearToast, customer, visible]);

  const updateForm = (key: keyof BasicCustomerProfileInput, value: string) => {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [key]: '' }));
  };

  const handleSave = async () => {
    if (isSubmitting) {
      return;
    }

    const validation = validateBasicInfo(form);
    setErrors(validation.errors);

    if (!validation.data) {
      showToast('Check the highlighted personal information fields.');
      return;
    }

    setIsSubmitting(true);

    try {
      await updateProfile(validation.data);
      createCustomerProfile(validation.data);
      onClose();
    } catch (error) {
      showToast(
        error instanceof ApiError && error.status === 0
          ? 'Unable to connect right now. Please try again.'
          : 'Unable to update your personal information.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProfileFormSheet
      onClose={onClose}
      overlay={(
        <FormToast
          message={message}
          onDismiss={clearToast}
          title={title}
          variant={variant}
        />
      )}
      title="Edit Personal Information"
      visible={visible}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <AvatarUploader
          imageUri={form.profilePicture}
          initials={initials}
          onChange={(imageUri) => updateForm('profilePicture', imageUri)}
        />

        <View className="mt-4 rounded-[28px] border border-[#E6EEFF] bg-white p-4 shadow-md shadow-[#17315F]/5">
          <FormInput
            autoCapitalize="words"
            error={errors.firstName}
            icon="person-outline"
            label="First Name"
            maxLength={100}
            onChangeText={(value) => updateForm('firstName', sanitizePersonName(value))}
            placeholder="Enter first name"
            required
            value={form.firstName}
          />
          <FormInput
            autoCapitalize="words"
            error={errors.lastName}
            icon="person-outline"
            label="Last Name"
            maxLength={100}
            onChangeText={(value) => updateForm('lastName', sanitizePersonName(value))}
            placeholder="Enter last name"
            required
            value={form.lastName}
          />
          <PhoneInput
            error={errors.contactNumber}
            onChangeText={(value) => updateForm('contactNumber', value)}
            required
            value={form.contactNumber}
          />
          <DatePickerInput
            error={errors.birthdate}
            initialVisibleDate="2000-01-01"
            label="Birthdate"
            maximumDate={getTodayDateKey()}
            minimumDate="1900-01-01"
            onChange={(value) => updateForm('birthdate', value)}
            placeholder="Select your birthdate"
            required
            value={form.birthdate}
          />
          <FormInput
            autoCapitalize="sentences"
            error={errors.address}
            icon="location-on"
            label="Address"
            multiline
            onChangeText={(value) => updateForm('address', value)}
            placeholder="House number, street, city, province"
            required
            value={form.address}
          />
        </View>

        <View className="mt-5 flex-row gap-3">
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            className="min-h-[50px] flex-1 items-center justify-center rounded-full border border-[#DDE8FF] bg-white px-4">
            <Text className="text-[13px] font-black text-[#17315F]">Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={handleSave}
            className="min-h-[50px] flex-1 items-center justify-center rounded-full bg-[#346EF6] px-4 shadow-md shadow-[#346EF6]/20">
            <Text className="text-[13px] font-black text-white">
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </ProfileFormSheet>
  );
}
