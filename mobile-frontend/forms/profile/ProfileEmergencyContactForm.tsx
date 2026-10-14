import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ProfileFormSheet } from '@/components/profile';
import { FormInput } from '@/components/ui/FormInput';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { FormToast, useFormToast } from '@/forms/shared/FormToast';
import { emergencyContactSchema, sanitizePersonName } from '@/validation';
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
  const { clearToast, message, showToast, title, variant } = useFormToast();
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
  } = useForm<EmergencyContact>({
    defaultValues: contact,
    resolver: zodResolver(emergencyContactSchema),
  });
  const relationshipValue = watch('relationship');

  useEffect(() => {
    if (visible) {
      reset(contact);
      clearToast();
    }
  }, [clearToast, contact, reset, visible]);

  const onSubmit = async (values: EmergencyContact) => {
    try {
      await saveEmergencyContact(values);
      updateEmergencyContact(values);
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        const fieldMap: Record<string, keyof EmergencyContact> = {
          name: 'name',
          phone_number: 'contactNumber',
          relationship: 'relationship',
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
          : 'Unable to update the emergency contact.',
      );
    }
  };

  return (
    <ProfileFormSheet
      onClose={onClose}
      overlay={<FormToast message={message} onDismiss={clearToast} title={title} variant={variant} />}
      title="Edit Emergency Contact"
      visible={visible}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View className="gap-3 rounded-card border border-border bg-surface p-4 ">
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <FormInput
                autoCapitalize="words"
                error={fieldState.error?.message}
                icon="person-outline"
                label="Emergency Contact Name"
                maxLength={100}
                onBlur={field.onBlur}
                onChangeText={(value) => field.onChange(sanitizePersonName(value))}
                placeholder="Full name"
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
                label="Emergency Contact Number"
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                placeholder="09XX XXX XXXX"
                required
                value={field.value}
              />
            )}
          />
          <View className="relative mb-8 gap-2">
            <Text className="font-sans text-[12px] font-normal text-secondary-foreground">
              Relationship <Text className="text-destructive">*</Text>
            </Text>
            <View className="flex-row flex-wrap gap-2.5">
              {relationshipOptions.map((relationship) => {
                const isSelected = relationshipValue === relationship;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    key={relationship}
                    onPress={() => {
                      setValue('relationship', relationship, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    className={cx(
                      'min-h-[42px] items-center justify-center rounded-full border px-4',
                      isSelected ? 'border-primary bg-muted' : 'border-border bg-background',
                    )}>
                    <Text
                      className={cx(
                        'font-sans',
                        'text-[13px] font-semibold',
                        isSelected ? 'text-primary' : 'text-foreground',
                      )}>
                      {relationship}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View className="absolute left-1 right-1 top-full mt-1.5">
              {errors.relationship ? (
                <Text className="font-sans text-[11px] font-medium leading-4 text-destructive">
                  {errors.relationship.message}
                </Text>
              ) : (
                <Text className="font-sans text-[11px] font-medium leading-4 text-secondary-foreground">
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
            className="min-h-[50px] flex-1 items-center justify-center rounded-full border border-border bg-surface px-4">
            <Text className="font-sans text-[13px] font-semibold text-foreground">Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={handleSubmit(onSubmit, () => {
              showToast('Check the highlighted emergency contact fields.');
            })}
            className="min-h-[50px] flex-1 items-center justify-center rounded-full bg-primary px-4 ">
            <Text className="font-sans text-[13px] font-semibold text-surface">
              {isSubmitting ? 'Saving...' : 'Save'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </ProfileFormSheet>
  );
}
