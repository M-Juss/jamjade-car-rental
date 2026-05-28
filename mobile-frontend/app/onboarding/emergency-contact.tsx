import { useRouter, type Href } from 'expo-router';
import { PhoneCall } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingScreenFrame } from '@/components/onboarding/OnboardingScreenFrame';
import { BottomActionButton } from '@/components/ui/BottomActionButton';
import { FormInput } from '@/components/ui/FormInput';
import { PhoneInput } from '@/components/ui/PhoneInput';
import {
  updateEmergencyContact,
  useCustomer,
} from '@/lib/customer/customer-store';
import type { EmergencyContact, EmergencyRelationship } from '@/types/customer';
import {
  hasErrors,
  validateEmergencyContact,
  type EmergencyContactField,
  type FieldErrors,
} from '@/utils/validation';

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

export default function EmergencyContactScreen() {
  const router = useRouter();
  const customer = useCustomer();
  const [contact, setContact] = useState<EmergencyContact>(customer.emergencyContact);
  const [errors, setErrors] = useState<FieldErrors<EmergencyContactField>>({});

  const goToNextStep = () => {
    if (customer.isBelow18) {
      router.push('/onboarding/age-restriction' as Href);
      return;
    }

    router.push('/onboarding/driving-intent' as Href);
  };

  const updateContact = (key: keyof EmergencyContact, value: string) => {
    setContact((currentContact) => ({ ...currentContact, [key]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [key]: '' }));
  };

  const handleContinue = () => {
    const nextErrors = validateEmergencyContact(contact);
    setErrors(nextErrors);

    if (hasErrors(nextErrors)) {
      return;
    }

    updateEmergencyContact(contact);
    goToNextStep();
  };

  const handleSkip = () => {
    updateEmergencyContact({ name: '', contactNumber: '', relationship: '' });
    goToNextStep();
  };

  return (
    <OnboardingScreenFrame
      action={
        <BottomActionButton
          label="Continue"
          onPress={handleContinue}
          secondaryLabel="Skip for now"
          onSecondaryPress={handleSkip}
        />
      }>
      <OnboardingHeader
        currentStep={2}
        icon={PhoneCall}
        subtitle="Emergency contact is optional for now. You can add or update it later from your profile."
        title="Emergency contact"
        totalSteps={4}
      />

      <View className="mt-7 gap-4 rounded-[28px] border border-[#E6EEFF] bg-white p-4 shadow-md shadow-[#17315F]/5">
        <FormInput
          autoCapitalize="words"
          error={errors.name}
          icon="person-outline"
          label="Emergency Contact Name"
          onChangeText={(value) => updateContact('name', value)}
          placeholder="Full name"
          value={contact.name}
        />
        <PhoneInput
          error={errors.contactNumber}
          label="Emergency Contact Number"
          onChangeText={(value) => updateContact('contactNumber', value)}
          placeholder="09XX XXX XXXX"
          value={contact.contactNumber}
        />
        <View className="gap-2">
          <Text className="text-[12px] font-black text-[#6C7A96]">Relationship</Text>
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
          {errors.relationship ? (
            <Text className="px-1 text-[11px] font-bold leading-4 text-[#D92D20]">{errors.relationship}</Text>
          ) : (
            <Text className="px-1 text-[11px] font-bold leading-4 text-[#91A0B8]">
              Select one if you add an emergency contact.
            </Text>
          )}
        </View>
      </View>
    </OnboardingScreenFrame>
  );
}
