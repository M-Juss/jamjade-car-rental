import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, type Href } from 'expo-router';
import { PhoneCall } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';

import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { OnboardingScreenFrame } from '@/components/onboarding/OnboardingScreenFrame';
import { BottomActionButton } from '@/components/ui/BottomActionButton';
import { FormInput } from '@/components/ui/FormInput';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { FormToast, useFormToast } from '@/forms/shared/FormToast';
import { emergencyContactSchema, sanitizePersonName } from '@/validation';
import { skipEmergencyContact, updateEmergencyContact, useCustomer } from '@/lib/customer/customer-store';
import type { EmergencyContact, EmergencyRelationship } from '@/types/customer';
import { saveEmergencyContact, skipEmergencyContact as skipEmergencyContactApi } from '@/services/api';
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
  const [isSkipping, setIsSkipping] = useState(false);
  const toast = useFormToast();
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    setError,
    setValue,
    watch,
  } = useForm<EmergencyContact>({
    defaultValues: customer.emergencyContact,
    resolver: zodResolver(emergencyContactSchema),
  });
  const relationshipValue = watch('relationship');

  const goToNextStep = async () => {
    if (customer.isBelow18) {
      router.replace('/onboarding/age-restriction' as Href);
      return;
    }

    router.push('/onboarding/driving-intent' as Href);
  };

  const onSubmit = async (values: EmergencyContact) => {
    try {
      await saveEmergencyContact(values);
      updateEmergencyContact(values);
      await goToNextStep();
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        const fieldMap: Record<string, keyof EmergencyContact> = {
          name: 'name',
          phone_number: 'contactNumber',
          relationship: 'relationship',
        };

        Object.entries(error.errors).forEach(([serverField, messages]) => {
          const field = fieldMap[serverField];
          const message = messages[0];

          if (field && message) {
            setError(field, { message, type: 'server' });
          }
        });
      }

      toast.showToast(
        error instanceof ApiError && error.status === 0
          ? 'Unable to connect right now. Please try again.'
          : 'Unable to save the emergency contact.',
      );
    }
  };

  const handleSkip = async () => {
    if (isSubmitting || isSkipping) {
      return;
    }

    setIsSkipping(true);

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
      setIsSkipping(false);
    }
  };

  return (
    <View className="flex-1">
      <OnboardingScreenFrame
        action={
          <BottomActionButton
            disabled={isSubmitting || isSkipping}
            label={isSubmitting ? 'Saving...' : 'Continue'}
            onPress={handleSubmit(onSubmit, () => {
              toast.showToast('Complete all required emergency contact fields.');
            })}
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

        <View className="mt-7 gap-4 rounded-card border border-border bg-surface p-4 ">
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
