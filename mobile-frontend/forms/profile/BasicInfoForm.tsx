import { zodResolver } from '@hookform/resolvers/zod';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { useCallback } from 'react';
import { Controller, useForm, type FieldPath } from 'react-hook-form';
import { BackHandler, View } from 'react-native';

import { LogoutConfirmationDialog } from '@/components/auth/LogoutConfirmationDialog';
import { AvatarUploader } from '@/components/onboarding/AvatarUploader';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingScreenFrame } from '@/components/onboarding/OnboardingScreenFrame';
import { ProfileAddressFields } from '@/components/profile/ProfileAddressFields';
import { BottomActionButton } from '@/components/ui/BottomActionButton';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import { FormInput } from '@/components/ui/FormInput';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { FormToast, useFormToast } from '@/forms/shared/FormToast';
import { useLogoutConfirmation } from '@/hooks/use-logout-confirmation';
import { basicInfoSchema, sanitizePersonName } from '@/validation';
import {
  createCustomerProfile,
  emptyCustomerAddress,
  getCustomerInitials,
  useCustomer,
} from '@/lib/customer/customer-store';
import type { BasicCustomerProfileInput } from '@/types/customer';
import { BOOKING_AGE_REQUIREMENT_MESSAGE, getLatestEligibleBirthdateKey } from '@/utils/calculateAge';
import { updateProfile } from '@/services/api';
import { ApiError } from '@/services/http';
import { useAuth } from '@/providers/AuthProvider';

function getProfileSaveErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return 'Unable to connect right now. Please try again.';
    }

    if (error.status === 401 || error.status === 419) {
      return error.message;
    }

    if (error.status === 422) {
      return 'Please correct the highlighted fields and try again.';
    }
  }

  return 'Unable to save your profile. Please try again.';
}

export function BasicInfoForm() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const customer = useCustomer();
  const toast = useFormToast();
  const {
    visible: logoutVisible,
    isLoggingOut,
    open: openLogout,
    close: closeLogout,
    confirm: confirmLogout,
  } = useLogoutConfirmation();
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    setError,
    setValue,
    watch,
  } = useForm<BasicCustomerProfileInput>({
    defaultValues: {
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
    },
    resolver: zodResolver(basicInfoSchema),
  });
  const form = watch();
  const backDisabled = isSubmitting || isLoggingOut;
  const goBack = useCallback(() => {
    if (backDisabled) return;
    if (router.canGoBack()) router.back();
    else openLogout();
  }, [backDisabled, openLogout, router]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        goBack();
        return true;
      });
      return () => subscription.remove();
    }, [goBack]),
  );

  const initials =
    [form.firstName, form.lastName]
      .filter(Boolean)
      .map((name) => name[0])
      .join('')
      .toUpperCase() || getCustomerInitials(customer);

  const onSubmit = async (values: BasicCustomerProfileInput) => {
    try {
      await updateProfile(values);
      createCustomerProfile(values);
      await refreshProfile();
      router.push('/onboarding/emergency-contact' as Href);
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
          const message = messages[0];

          if (field && message) {
            setError(field, { message, type: 'server' });
          }
        });
      }

      toast.showToast(getProfileSaveErrorMessage(error));
    }
  };

  return (
    <View className="flex-1">
      <OnboardingScreenFrame
        action={
          <BottomActionButton
            disabled={isSubmitting || isLoggingOut || logoutVisible}
            label={isSubmitting ? 'Saving...' : 'Continue'}
            onPress={handleSubmit(onSubmit, () => {
              toast.showToast('Check the highlighted profile fields.');
            })}
          />
        }>
        <OnboardingHeader
          backDisabled={backDisabled}
          currentStep={1}
          icon={ShieldCheck}
          onBackPress={goBack}
          title="Basic information"
          totalSteps={3}
        />

        <View className="mt-7 gap-4">
          <AvatarUploader
            error={errors.profilePicture?.message}
            imageUri={form.profilePicture}
            initials={initials}
            onChange={(imageUri) => {
              setValue('profilePicture', imageUri, {
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
          />

          <View className="gap-4 rounded-card border border-border bg-surface p-4 ">
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
        </View>
      </OnboardingScreenFrame>
      <LogoutConfirmationDialog
        accountLabel="customer"
        isLoading={isLoggingOut}
        onCancel={closeLogout}
        onConfirm={confirmLogout}
        visible={logoutVisible}
      />
      <FormToast
        message={toast.message}
        onDismiss={toast.clearToast}
        title={toast.title}
        variant={toast.variant}
      />
    </View>
  );
}
