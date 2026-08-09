import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AvatarUploader } from '@/components/onboarding/AvatarUploader';
import { ProfileFormSheet } from '@/components/profile';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import { FormInput } from '@/components/ui/FormInput';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { FormToast, useFormToast } from '@/forms/shared/FormToast';
import {
  basicInfoSchema,
  sanitizePersonName,
} from '@/validation';
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
import {
  BOOKING_AGE_REQUIREMENT_MESSAGE,
  getLatestEligibleBirthdateKey,
} from '@/utils/calculateAge';

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
  const { clearToast, message, showToast, title, variant } = useFormToast();
  const {
    control,
    formState: { isSubmitting },
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
  } = useForm<BasicCustomerProfileInput>({
    defaultValues: getFormValues(customer),
    resolver: zodResolver(basicInfoSchema),
  });
  const form = watch();
  const initials =
    [form.firstName, form.lastName]
      .filter(Boolean)
      .map((name) => name[0])
      .join('')
      .toUpperCase() || getCustomerInitials(customer);

  useEffect(() => {
    if (visible) {
      reset(getFormValues(customer));
      clearToast();
    }
  }, [clearToast, customer, reset, visible]);

  const onSubmit = async (values: BasicCustomerProfileInput) => {
    try {
      await updateProfile(values);
      createCustomerProfile(values);
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        const fieldMap: Record<string, keyof BasicCustomerProfileInput> = {
          address: 'address',
          birthdate: 'birthdate',
          first_name: 'firstName',
          last_name: 'lastName',
          phone_number: 'contactNumber',
          profile_picture: 'profilePicture',
        };

        Object.entries(error.errors).forEach(([serverField, messages]) => {
          const field = fieldMap[serverField];
          const serverMessage = messages[0];

          if (field && serverMessage) {
            setError(field, { message: serverMessage, type: 'server' });
          }
        });
      }

      showToast(
        error instanceof ApiError && error.status === 0
          ? 'Unable to connect right now. Please try again.'
          : 'Unable to update your personal information.',
      );
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
          onChange={(imageUri) => {
            setValue('profilePicture', imageUri, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }}
        />

        <View className="mt-4 rounded-[28px] border border-border bg-surface p-4 shadow-md shadow-foreground/5">
          <Controller
            control={control}
            name="firstName"
            render={({ field, fieldState }) => (
              <FormInput
                autoCapitalize="words"
                error={fieldState.error?.message}
                icon="person-outline"
                label="First Name"
                maxLength={100}
                onBlur={field.onBlur}
                onChangeText={(value) => field.onChange(sanitizePersonName(value))}
                placeholder="Enter first name"
                required
                value={field.value}
              />
            )}
          />
          <Controller
            control={control}
            name="lastName"
            render={({ field, fieldState }) => (
              <FormInput
                autoCapitalize="words"
                error={fieldState.error?.message}
                icon="person-outline"
                label="Last Name"
                maxLength={100}
                onBlur={field.onBlur}
                onChangeText={(value) => field.onChange(sanitizePersonName(value))}
                placeholder="Enter last name"
                required
                value={field.value}
              />
            )}
          />
          <Controller
            control={control}
            name="contactNumber"
            render={({ field, fieldState }) => (
              <PhoneInput
                error={fieldState.error?.message}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                required
                value={field.value}
              />
            )}
          />
          <Controller
            control={control}
            name="birthdate"
            render={({ field, fieldState }) => (
              <DatePickerInput
                error={fieldState.error?.message}
                helperText={BOOKING_AGE_REQUIREMENT_MESSAGE}
                initialVisibleDate="2000-01-01"
                label="Birthdate"
                maximumDate={getLatestEligibleBirthdateKey()}
                minimumDate="1900-01-01"
                onChange={field.onChange}
                placeholder="Select your birthdate"
                required
                value={field.value}
              />
            )}
          />
          <Controller
            control={control}
            name="address"
            render={({ field, fieldState }) => (
              <FormInput
                autoCapitalize="sentences"
                error={fieldState.error?.message}
                icon="location-on"
                label="Address"
                multiline
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                placeholder="House number, street, city, province"
                required
                value={field.value}
              />
            )}
          />
        </View>

        <View className="mt-5 flex-row gap-3">
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            className="min-h-[50px] flex-1 items-center justify-center rounded-full border border-border bg-surface px-4">
            <Text className="text-[13px] font-black text-foreground">Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={handleSubmit(onSubmit, () => {
              showToast('Check the highlighted personal information fields.');
            })}
            className="min-h-[50px] flex-1 items-center justify-center rounded-full bg-primary px-4 shadow-md shadow-primary/20">
            <Text className="text-[13px] font-black text-surface">
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </ProfileFormSheet>
  );
}
