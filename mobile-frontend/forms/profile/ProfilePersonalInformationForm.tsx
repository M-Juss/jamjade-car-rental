import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm, type FieldPath } from 'react-hook-form';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AvatarUploader } from '@/components/onboarding/AvatarUploader';
import { ProfileAddressFields, ProfileFormSheet } from '@/components/profile';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import { FormInput } from '@/components/ui/FormInput';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { FormToast, useFormToast } from '@/forms/shared/FormToast';
import { basicInfoSchema, sanitizePersonName } from '@/validation';
import {
  createCustomerProfile,
  emptyCustomerAddress,
  getCustomerInitials,
} from '@/lib/customer/customer-store';
import type { BasicCustomerProfileInput, Customer } from '@/types/customer';
import { updateProfile } from '@/services/api';
import { ApiError } from '@/services/http';
import { useAuth } from '@/providers/AuthProvider';
import { BOOKING_AGE_REQUIREMENT_MESSAGE, getLatestEligibleBirthdateKey } from '@/utils/calculateAge';

function getFormValues(customer: Customer): BasicCustomerProfileInput {
  return {
    address: customer.address,
    addressDetails: customer.addressDetails.regionCode
      ? customer.addressDetails
      : {
          ...emptyCustomerAddress,
          addressLine: customer.address,
          formattedAddress: customer.address,
        },
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
  const { refreshProfile } = useAuth();
  const { clearToast, message, showToast, title, variant } = useFormToast();
  const {
    control,
    formState: { errors, isSubmitting },
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
      await refreshProfile().catch(() => undefined);
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        const fieldMap: Record<string, FieldPath<BasicCustomerProfileInput>> = {
          address: 'address',
          address_details: 'addressDetails.provinceCode',
          address_line: 'addressDetails.addressLine',
          barangay_code: 'addressDetails.barangayCode',
          city_municipality_code: 'addressDetails.cityMunicipalityCode',
          country_code: 'addressDetails.countryCode',
          postal_code: 'addressDetails.postalCode',
          province_code: 'addressDetails.provinceCode',
          region_code: 'addressDetails.regionCode',
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
      overlay={<FormToast message={message} onDismiss={clearToast} title={title} variant={variant} />}
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

        <View className="mt-4 rounded-card border border-border bg-surface p-4 ">
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
            name="addressDetails"
            render={({ field }) => (
              <ProfileAddressFields
                errors={errors.addressDetails}
                onChange={(addressDetails) => {
                  field.onChange(addressDetails);
                  setValue('address', addressDetails.formattedAddress, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
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
            <Text className="font-sans text-[13px] font-semibold text-foreground">Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={handleSubmit(onSubmit, () => {
              showToast('Check the highlighted personal information fields.');
            })}
            className="min-h-[50px] flex-1 items-center justify-center rounded-full bg-primary px-4 ">
            <Text className="font-sans text-[13px] font-semibold text-surface">
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </ProfileFormSheet>
  );
}
