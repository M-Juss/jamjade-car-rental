import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Text, View } from 'react-native';

import { ActionButton, SectionCard } from '@/components/bookings';
import { InputWithLabel } from '@/components/common/InputWithLabel';
import { SelectWithLabel } from '@/components/common/SelectWithLabel';
import { ClipboardList } from 'lucide-react-native';
import type { FormToastVariant } from '@/forms/shared/FormToast';
import { RC_BATTERY, RC_INTENSITIES, RC_MOVEMENTS, RC_MOUNTS, RC_SESSION_DEFAULTS, RC_SLOPES, RC_SURFACES } from '@/lib/research/rc-research';
import { ApiError } from '@/services/http';
import { needsIntensity, rcSessionSetupSchema, type RcSessionSetupInput } from '@/validation/research/rc-research';

export function RcSessionSetupForm({ onCreate, hasSession, onFeedback }: {
  onCreate: (values: RcSessionSetupInput) => Promise<boolean>;
  hasSession: boolean;
  onFeedback: (message: string, variant?: FormToastVariant) => void;
}) {
  const { control, watch, setValue, handleSubmit, setError, formState: { isSubmitting, errors } } = useForm<RcSessionSetupInput>({
    resolver: zodResolver(rcSessionSetupSchema), defaultValues: RC_SESSION_DEFAULTS,
  });
  const movement = watch('movement');
  const submit = async (values: RcSessionSetupInput) => {
    try { if (await onCreate(values)) onFeedback('Session ready for recording.', 'success'); }
    catch (error) {
      if (error instanceof ApiError && error.errors) {
        for (const field of ['name', 'surface', 'slope', 'mount_orientation', 'battery_condition'] as const)
          if (error.errors[field]?.[0]) setError(field, { message: error.errors[field][0] });
      }
      const message = error instanceof ApiError && error.status === 422 ? 'Check the highlighted session details.'
        : 'The session could not be created. Check your connection and try again.';
      setError('root', { message }); onFeedback(message);
    }
  };
  return (
    <View className="gap-4">
      <SectionCard title="Session details" icon={ClipboardList}>
        <View className="gap-4">
          <Controller control={control} name="name" render={({ field, fieldState }) => <InputWithLabel
            label="Session name" required maxLength={100} disabled={isSubmitting} value={field.value} onChangeText={field.onChange}
            onBlur={field.onBlur} error={fieldState.error?.message} />} />
          <Controller control={control} name="surface" render={({ field, fieldState }) => <SelectWithLabel label="Surface" required
            options={RC_SURFACES} value={field.value} onValueChange={field.onChange} error={fieldState.error?.message} disabled={isSubmitting} />} />
          <Controller control={control} name="slope" render={({ field, fieldState }) => <SelectWithLabel label="Slope" required
            options={RC_SLOPES} value={field.value} onValueChange={field.onChange} error={fieldState.error?.message} disabled={isSubmitting} />} />
          <Controller control={control} name="mount_orientation" render={({ field, fieldState }) => <SelectWithLabel label="Mount orientation" required
            options={RC_MOUNTS} value={field.value} onValueChange={field.onChange} error={fieldState.error?.message} disabled={isSubmitting} />} />
          <Controller control={control} name="battery_condition" render={({ field, fieldState }) => <SelectWithLabel label="Battery condition" required
            options={RC_BATTERY} value={field.value} onValueChange={field.onChange} error={fieldState.error?.message} disabled={isSubmitting} />} />
          <Text className="font-sans text-caption text-secondary-foreground">Added load: none</Text>
          <View className="h-px bg-border" />
          <Text className="font-sans text-body font-semibold text-foreground">Intended movement</Text>
          <Controller control={control} name="movement" render={({ field, fieldState }) => <SelectWithLabel label="Movement" required options={RC_MOVEMENTS}
            value={field.value} onValueChange={value => { field.onChange(value); setValue('intensity', needsIntensity(value) ? 'normal' : 'not_applicable'); }}
            error={fieldState.error?.message} disabled={isSubmitting} />} />
          {movement && needsIntensity(movement) ? <Controller control={control} name="intensity" render={({ field, fieldState }) => <SelectWithLabel label="Movement intensity"
            required options={RC_INTENSITIES} value={field.value} onValueChange={field.onChange} error={fieldState.error?.message} disabled={isSubmitting} />} /> : null}
          <Text className="font-sans text-caption text-secondary-foreground">Recording uses motion sensors while the app is open.</Text>
        </View>
      </SectionCard>
      {errors.root ? <Text accessibilityRole="alert" className="font-sans text-body text-destructive">{errors.root.message}</Text> : null}
      <ActionButton label={isSubmitting ? 'Creating session…' : hasSession ? 'Continue to recording' : 'Agree & create session'} variant="primary" disabled={isSubmitting}
        onPress={() => {
          setValue('consent', true);
          void handleSubmit(submit, () => onFeedback('Complete the highlighted session details.'))();
        }} />
    </View>
  );
}
