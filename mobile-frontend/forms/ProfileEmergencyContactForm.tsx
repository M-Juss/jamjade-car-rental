import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ProfileFormSheet } from '@/components/profile';
import { FormInput } from '@/components/ui/FormInput';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { FormToast, useFormToast } from '@/forms/FormToast';
import {
  validateEmergencyContact,
  sanitizePersonName,
  type EmergencyContactField,
  type FieldErrors,
} from '@/forms/validation';
import { updateEmergencyContact } from '@/lib/customer/customer-store';
import { saveEmergencyContact } from '@/services/api';
import { ApiError } from '@/services/http';
import type { EmergencyContact, EmergencyRelationship } from '@/types/customer';

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

export function ProfileEmergencyContactForm({
  contact,
  onClose,
  visible,
}: {
  contact: EmergencyContact;
  visible: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState<EmergencyContact>(contact);
  const [errors, setErrors] = useState<FieldErrors<EmergencyContactField>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { clearToast, message, showToast, title, variant } = useFormToast();

  useEffect(() => {
    if (visible) {
      setForm(contact);
      setErrors({});
      clearToast();
    }
  }, [clearToast, contact, visible]);

  const updateForm = (key: keyof EmergencyContact, value: string) => {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [key]: '' }));
  };

  const handleSave = async () => {
    if (isSubmitting) {
      return;
    }

    const validation = validateEmergencyContact(form);
    setErrors(validation.errors);

    if (!validation.data) {
      showToast('Something went wrong.');
      return;
    }

    setIsSubmitting(true);

    try {
      await saveEmergencyContact(validation.data);
      updateEmergencyContact(validation.data);
      onClose();
    } catch (error) {
      showToast(
        error instanceof ApiError && error.status === 0
          ? 'Unable to connect right now. Please try again.'
          : 'Unable to update the emergency contact.',
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
      title="Edit Emergency Contact"
      visible={visible}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View className="gap-3 rounded-[28px] border border-[#E6EEFF] bg-white p-4 shadow-md shadow-[#17315F]/5">
          <FormInput
            autoCapitalize="words"
            error={errors.name}
            icon="person-outline"
            label="Emergency Contact Name"
            maxLength={100}
            onChangeText={(value) => updateForm('name', sanitizePersonName(value))}
            placeholder="Full name"
            required
            value={form.name}
          />
          <PhoneInput
            error={errors.contactNumber}
            label="Emergency Contact Number"
            onChangeText={(value) => updateForm('contactNumber', value)}
            placeholder="09XX XXX XXXX"
            required
            value={form.contactNumber}
          />
          <View className="relative mb-8 gap-2">
            <Text className="text-[12px] font-black text-[#6C7A96]">
              Relationship <Text className="text-[#E5484D]">*</Text>
            </Text>
            <View className="flex-row flex-wrap gap-2.5">
              {relationshipOptions.map((relationship) => {
                const isSelected = form.relationship === relationship;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    key={relationship}
                    onPress={() => updateForm('relationship', relationship)}
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
              {isSubmitting ? 'Saving...' : 'Save'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </ProfileFormSheet>
  );
}
