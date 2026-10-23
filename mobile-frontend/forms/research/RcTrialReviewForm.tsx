import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { ClipboardCheck } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { ActionButton, SectionCard } from '@/components/bookings';
import { InputWithLabel } from '@/components/common/InputWithLabel';
import { SelectWithLabel } from '@/components/common/SelectWithLabel';
import type { FormToastVariant } from '@/forms/shared/FormToast';
import { RC_INTENSITIES, RC_LABEL_STATUS, RC_MOVEMENTS, RC_QUALITY, type RcCaptureResult } from '@/lib/research/rc-research';
import { ApiError } from '@/services/http';
import { needsIntensity, rcTrialReviewSchema, type RcSessionSetupInput, type RcTrialReviewInput } from '@/validation/research/rc-research';

export function RcTrialReviewForm({ capture, intended, onSave, onFeedback }: {
  capture: RcCaptureResult; intended: RcSessionSetupInput;
  onSave: (values: RcTrialReviewInput) => Promise<boolean>;
  onFeedback: (message: string, variant?: FormToastVariant) => void;
}) {
  const { control, watch, setValue, setError, handleSubmit, formState: { isSubmitting, errors } } = useForm<RcTrialReviewInput>({
    resolver: zodResolver(rcTrialReviewSchema(capture.summary.duration_ms)),
    defaultValues: { observed_movement: intended.movement, observed_intensity: intended.intensity,
      event_start_ms: 0, event_end_ms: Math.floor(capture.summary.duration_ms), notes: '' },
  });
  const movement = watch('observed_movement');
  const submit = async (values: RcTrialReviewInput) => {
    try { if (await onSave(values)) onFeedback('Trial saved.', 'success'); }
    catch (error) {
      if (error instanceof ApiError && error.errors) {
        for (const field of ['observed_movement', 'observed_intensity', 'label_status', 'quality', 'event_start_ms', 'event_end_ms', 'notes'] as const)
          if (error.errors[field]?.[0]) setError(field, { message: error.errors[field][0] });
      }
      const message = error instanceof ApiError && error.status === 409 ? 'This recording was already saved or deleted. Check Data before retrying.'
        : error instanceof ApiError && error.status === 422 ? error.errors?.samples_json?.[0] ?? error.errors?.ended_at?.[0] ?? 'Check the highlighted trial details.'
        : 'The trial could not be saved. Your recording is still here; try again.';
      setError('root', { message }); onFeedback(message);
    }
  };
  return <View className="gap-4">
    <SectionCard title="Trial review" icon={ClipboardCheck}>
      <View className="gap-4">
        <Controller control={control} name="observed_movement" render={({ field, fieldState }) => <SelectWithLabel label="Observed movement" required
          options={RC_MOVEMENTS} value={field.value} onValueChange={value => { field.onChange(value); setValue('observed_intensity', needsIntensity(value) ? 'normal' : 'not_applicable'); }}
          error={fieldState.error?.message} disabled={isSubmitting} />} />
        {needsIntensity(movement) ? <Controller control={control} name="observed_intensity" render={({ field, fieldState }) => <SelectWithLabel label="Observed intensity"
          required options={RC_INTENSITIES} value={field.value} onValueChange={field.onChange} error={fieldState.error?.message} disabled={isSubmitting} />} /> : null}
        <Controller control={control} name="label_status" render={({ field, fieldState }) => <SelectWithLabel label="Label certainty" required options={RC_LABEL_STATUS}
          value={field.value} onValueChange={field.onChange} error={fieldState.error?.message} disabled={isSubmitting} />} />
        <Controller control={control} name="quality" render={({ field, fieldState }) => <SelectWithLabel label="Recording quality" required options={RC_QUALITY}
          value={field.value} onValueChange={field.onChange} error={fieldState.error?.message} disabled={isSubmitting} />} />
        {(['event_start_ms', 'event_end_ms'] as const).map(name => <Controller key={name} control={control} name={name} render={({ field, fieldState }) => <InputWithLabel
          label={name === 'event_start_ms' ? 'Event start (ms)' : 'Event end (ms)'} required keyboardType="numeric" disabled={isSubmitting}
          value={Number.isFinite(field.value) ? String(field.value) : ''} onChangeText={value => field.onChange(value.trim() === '' ? NaN : Number(value))}
          onBlur={field.onBlur} error={fieldState.error?.message} />} />)}
        <Controller control={control} name="notes" render={({ field, fieldState }) => <InputWithLabel label="Notes" multiline maxLength={500}
          value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} disabled={isSubmitting} />} />
      </View>
    </SectionCard>
    {errors.root ? <Text accessibilityRole="alert" className="font-sans text-body text-destructive">{errors.root.message}</Text> : null}
    <ActionButton label={isSubmitting ? 'Saving trial…' : 'Save trial'} variant="primary" disabled={isSubmitting}
      onPress={() => void handleSubmit(submit, () => onFeedback('Complete the highlighted trial details.'))()} />
  </View>;
}
