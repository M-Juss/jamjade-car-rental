import { useRouter, type Href } from 'expo-router';
import { Cake, ShieldCheck } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { AvatarUploader } from '@/components/onboarding/AvatarUploader';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingScreenFrame } from '@/components/onboarding/OnboardingScreenFrame';
import { BottomActionButton } from '@/components/ui/BottomActionButton';
import { DatePickerInput, getTodayDateKey } from '@/components/ui/DatePickerInput';
import { FormInput } from '@/components/ui/FormInput';
import { PhoneInput } from '@/components/ui/PhoneInput';
import {
  createCustomerProfile,
  getCustomerInitials,
  useCustomer,
} from '@/lib/customer/customer-store';
import type { BasicCustomerProfileInput } from '@/types/customer';
import { calculateAge } from '@/utils/calculateAge';
import {
  hasErrors,
  validateBasicInfo,
  type FieldErrors,
  type BasicInfoField,
} from '@/utils/validation';

export default function BasicInfoScreen() {
  const router = useRouter();
  const customer = useCustomer();
  const [form, setForm] = useState<BasicCustomerProfileInput>({
    address: customer.address,
    birthdate: customer.birthdate,
    contactNumber: customer.contactNumber,
    firstName: customer.firstName,
    lastName: customer.lastName,
    profilePicture: customer.profilePicture,
  });
  const [errors, setErrors] = useState<FieldErrors<BasicInfoField>>({});
  const computedAge = useMemo(() => calculateAge(form.birthdate), [form.birthdate]);
  const initials = [form.firstName, form.lastName]
    .filter(Boolean)
    .map((name) => name[0])
    .join('')
    .toUpperCase() || getCustomerInitials(customer);

  const updateForm = (key: keyof BasicCustomerProfileInput, value: string) => {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [key]: '' }));
  };

  const handleContinue = () => {
    const nextErrors = validateBasicInfo(form);
    setErrors(nextErrors);

    if (hasErrors(nextErrors)) {
      return;
    }

    createCustomerProfile(form);
    router.push('/onboarding/emergency-contact' as Href);
  };

  return (
    <OnboardingScreenFrame
      action={<BottomActionButton label="Continue" onPress={handleContinue} />}>
      <OnboardingHeader
        currentStep={1}
        icon={ShieldCheck}
        subtitle="This helps Jamjade prepare your account and rental requirements."
        title="Basic information"
        totalSteps={4}
      />

      <View className="mt-7 gap-4">
        <AvatarUploader
          imageUri={form.profilePicture}
          initials={initials}
          onChange={(imageUri) => updateForm('profilePicture', imageUri)}
        />

        <View className="gap-4 rounded-[28px] border border-[#E6EEFF] bg-white p-4 shadow-md shadow-[#17315F]/5">
          <FormInput
            autoCapitalize="words"
            error={errors.firstName}
            icon="person-outline"
            label="First Name"
            onChangeText={(value) => updateForm('firstName', value)}
            placeholder="Enter first name"
            required
            value={form.firstName}
          />
          <FormInput
            autoCapitalize="words"
            error={errors.lastName}
            icon="person-outline"
            label="Last Name"
            onChangeText={(value) => updateForm('lastName', value)}
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
          <View>
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
            <View className="mt-3 flex-row items-center gap-3 rounded-[20px] bg-[#F3F7FF] p-4">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-white">
                <Cake size={18} color="#346EF6" strokeWidth={2.45} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-[12px] font-black text-[#6C7A96]">Computed age</Text>
                <Text className="mt-1 text-[17px] font-black text-[#17315F]">
                  {computedAge === null ? 'Choose birthdate first' : `${computedAge} years old`}
                </Text>
              </View>
            </View>
          </View>
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
      </View>
    </OnboardingScreenFrame>
  );
}
