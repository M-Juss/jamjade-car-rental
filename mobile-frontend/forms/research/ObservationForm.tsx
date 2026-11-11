import { zodResolver } from '@hookform/resolvers/zod';
import { ClipboardCheck } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';

import { ActionButton, SectionCard } from '@/components/bookings';
import { InputWithLabel } from '@/components/common/InputWithLabel';
import { SelectWithLabel } from '@/components/common/SelectWithLabel';
import { observationFlagLabels, type ObservationRevision } from '@/lib/research/collection';
import { observationFormValues, observationSaveError } from '@/lib/research/observations';
import { directionalSwerveCodes, initialDeviations, observationFlags, observationInputSchema, type ExerciseCode, type ObservationInput } from '@/validation/research/collection';

export function ObservationForm({ latest, exercise, disabled, onSave, onDirtyChange }: { onDirtyChange: (dirty: boolean) => void; latest?: ObservationRevision; exercise: ExerciseCode; disabled: boolean; onSave: (values: ObservationInput) => Promise<ObservationRevision> }) {
  const isSwerve = exercise === 'SW' || directionalSwerveCodes.some(code => code === exercise);
  const hasInitialDeviation = exercise === 'LC' || isSwerve;
  const expectedDeviation = exercise === 'SWL' || exercise === 'HSWL' ? 'left' : exercise === 'SWR' || exercise === 'HSWR' ? 'right' : null;
  const { control, handleSubmit, setValue, setError, clearErrors, reset, watch, formState: { errors, isSubmitting, isDirty } } = useForm<ObservationInput>({ resolver: zodResolver(observationInputSchema),
    defaultValues: hasInitialDeviation && !latest ? { ...observationFormValues(), initial_deviation: expectedDeviation ?? 'unknown' } : observationFormValues(latest) });
  const submitting = useRef(false);
  useEffect(() => { onDirtyChange(isDirty); }, [isDirty, onDirtyChange]);
  const source = watch('source');
  const completed = watch('completed_as_planned');
  const initialDeviation = watch('initial_deviation');
  const busy = disabled || isSubmitting;
  const saved = Boolean(latest) && !isDirty;
  const submit = async (values: ObservationInput) => {
    if (submitting.current || disabled || saved) return;
    submitting.current = true;
    clearErrors('root');
    try { reset(observationFormValues(await onSave(values))); }
    catch (error) { setError('root', { message: observationSaveError(error) }); }
    finally { submitting.current = false; }
  };
  return <SectionCard density="compact" title="What happened?" icon={ClipboardCheck}><View className="gap-3">
    <Controller control={control} name="completed_as_planned" render={({ field, fieldState }) => <SelectWithLabel label={isSwerve ? 'Cleared the obstacle and returned to the starting lane?' : 'Completed as planned?'} value={field.value === null ? 'unknown' : field.value ? 'yes' : 'no'}
      options={[{ value: 'unknown', label: 'Not sure' }, { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
      onValueChange={v => field.onChange(v === 'unknown' ? null : v === 'yes')} disabled={busy} error={fieldState.error?.message} />} />
    <Controller control={control} name="source" render={({ field, fieldState }) => <SelectWithLabel label="Report from" value={field.value}
      options={[{ value: 'operator_report', label: 'Operator' }, { value: 'observed', label: 'Teammate observing' }, { value: 'signal_review', label: 'Chart review only' }]}
      onValueChange={v => { field.onChange(v); setValue('observer_code', v === 'observed' ? 'OB01' : null); }} disabled={busy} error={fieldState.error?.message} />} />
    {source === 'observed' && <Controller control={control} name="observer_code" render={({ field, fieldState }) => <SelectWithLabel label="Observer code" value={field.value ?? ''}
      options={[{ value: 'OB01', label: 'OB01' }, { value: 'OB02', label: 'OB02' }]} onValueChange={field.onChange} disabled={busy} error={fieldState.error?.message} />} />}
    {hasInitialDeviation && (!expectedDeviation || completed === false || initialDeviation !== expectedDeviation) && <Controller control={control} name="initial_deviation" render={({ field, fieldState }) => <SelectWithLabel label="Initial deviation" value={field.value}
      options={initialDeviations.map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))}
      onValueChange={field.onChange} disabled={busy} error={fieldState.error?.message} />} />}
    <Controller control={control} name="actual_stop_method" render={({ field, fieldState }) => <SelectWithLabel label="How did it stop?" value={field.value} onValueChange={field.onChange} disabled={busy} error={fieldState.error?.message}
      options={[{ value: 'unknown', label: 'Not sure' }, { value: 'brake_applied', label: 'Applied brake' }, { value: 'neutral_release', label: 'Released to neutral' }, { value: 'not_applicable', label: 'Not applicable' }]} />} />
    <Text className="font-sans text-caption font-medium text-foreground">Observations (select any)</Text>
    <Controller control={control} name="flags" render={({ field, fieldState }) => <View className="gap-1"><View className="flex-row flex-wrap gap-2">{observationFlags.map(flag => {
      const checked = field.value.includes(flag);
      return <Pressable key={flag} accessibilityRole="checkbox" accessibilityState={{ checked, disabled: busy }} disabled={busy}
        onPress={() => field.onChange(checked ? field.value.filter(v => v !== flag) : [...field.value, flag])}
        className={`min-h-control justify-center rounded-field border px-3 py-2 ${checked ? 'border-primary bg-muted' : 'border-border bg-surface'}`}>
        <Text className="font-sans text-caption text-foreground">{checked ? '✓ ' : ''}{observationFlagLabels[flag]}</Text>
      </Pressable>;
    })}</View>{fieldState.error && <Text accessibilityRole="alert" className="font-sans text-caption text-destructive">{fieldState.error.message}</Text>}</View>} />
    <Controller control={control} name="notes" render={({ field, fieldState }) => <InputWithLabel label="Notes (optional)" value={field.value ?? ''} onChangeText={v => field.onChange(v || null)} multiline disabled={busy} maxLength={1000} error={fieldState.error?.message} />} />
    {errors.root?.message && <Text accessibilityRole="alert" className="font-sans text-caption text-destructive">{errors.root.message}</Text>}
    <ActionButton density="compact" label={isSubmitting ? 'Saving…' : saved ? 'Saved on phone' : 'Save observations'} variant="primary" disabled={busy || saved}
      onPress={() => { clearErrors('root'); void handleSubmit(submit, () => setError('root', { message: 'Check the highlighted observation fields.' }))(); }} />
    {saved && <Text accessibilityLiveRegion="polite" className="font-sans text-caption text-success">Observations saved on this phone.</Text>}
  </View></SectionCard>;
}
