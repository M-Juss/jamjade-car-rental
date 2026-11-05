import { zodResolver } from '@hookform/resolvers/zod';
import { ClipboardCheck } from 'lucide-react-native';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';

import { ActionButton, SectionCard } from '@/components/bookings';
import { InputWithLabel } from '@/components/common/InputWithLabel';
import { SelectWithLabel } from '@/components/common/SelectWithLabel';
import { observationFlagLabels, type ObservationRevision } from '@/lib/research/collection';
import { observationFlags, observationInputSchema, type ObservationInput } from '@/validation/research/collection';

export function ObservationForm({ latest, disabled, onSave }: { latest?: ObservationRevision; disabled: boolean; onSave: (values: ObservationInput) => Promise<void> }) {
  const { control, handleSubmit, setValue, watch, formState: { isSubmitting } } = useForm<ObservationInput>({ resolver: zodResolver(observationInputSchema),
    defaultValues: { base_revision: latest?.revision ?? 0, completed_as_planned: latest?.completed_as_planned ?? null,
      source: latest?.source ?? 'operator_report', observer_code: latest?.observer_code ?? null, flags: latest?.flags ?? [],
      actual_stop_method: latest?.actual_stop_method ?? 'unknown', notes: latest?.notes ?? null } });
  const source = watch('source');
  const busy = disabled || isSubmitting;
  return <SectionCard title="What happened?" icon={ClipboardCheck}><View className="gap-4">
    <Text className="font-sans text-caption text-secondary-foreground">Original saved. These observations describe the run; event labels are reviewed separately.</Text>
    <Controller control={control} name="completed_as_planned" render={({ field, fieldState }) => <SelectWithLabel label="Completed as planned?" value={field.value === null ? 'unknown' : field.value ? 'yes' : 'no'}
      options={[{ value: 'unknown', label: 'Not sure' }, { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
      onValueChange={v => field.onChange(v === 'unknown' ? null : v === 'yes')} disabled={busy} error={fieldState.error?.message} />} />
    <Controller control={control} name="source" render={({ field, fieldState }) => <SelectWithLabel label="Report from" value={field.value}
      options={[{ value: 'operator_report', label: 'Operator' }, { value: 'observed', label: 'Teammate observing' }, { value: 'signal_review', label: 'Chart review only' }]}
      onValueChange={v => { field.onChange(v); setValue('observer_code', v === 'observed' ? 'OB01' : null); }} disabled={busy} error={fieldState.error?.message} />} />
    {source === 'observed' && <Controller control={control} name="observer_code" render={({ field, fieldState }) => <SelectWithLabel label="Observer code" value={field.value ?? ''}
      options={[{ value: 'OB01', label: 'OB01' }, { value: 'OB02', label: 'OB02' }]} onValueChange={field.onChange} disabled={busy} error={fieldState.error?.message} />} />}
    <Controller control={control} name="actual_stop_method" render={({ field, fieldState }) => <SelectWithLabel label="How did it stop?" value={field.value} onValueChange={field.onChange} disabled={busy} error={fieldState.error?.message}
      options={[{ value: 'unknown', label: 'Not sure' }, { value: 'brake_applied', label: 'Applied brake' }, { value: 'neutral_release', label: 'Released to neutral' }, { value: 'not_applicable', label: 'Not applicable' }]} />} />
    <Text className="font-sans text-caption font-medium text-foreground">Observations (select any)</Text>
    <Controller control={control} name="flags" render={({ field }) => <View className="flex-row flex-wrap gap-2">{observationFlags.map(flag => {
      const checked = field.value.includes(flag);
      return <Pressable key={flag} accessibilityRole="checkbox" accessibilityState={{ checked, disabled: busy }} disabled={busy}
        onPress={() => field.onChange(checked ? field.value.filter(v => v !== flag) : [...field.value, flag])}
        className={`min-h-control justify-center rounded-field border px-3 py-2 ${checked ? 'border-primary bg-muted' : 'border-border bg-surface'}`}>
        <Text className="font-sans text-caption text-foreground">{checked ? '✓ ' : ''}{observationFlagLabels[flag]}</Text>
      </Pressable>;
    })}</View>} />
    <Controller control={control} name="notes" render={({ field, fieldState }) => <InputWithLabel label="Notes (optional)" value={field.value ?? ''} onChangeText={v => field.onChange(v || null)} multiline disabled={busy} maxLength={1000} error={fieldState.error?.message} />} />
    <ActionButton label="Save observations on phone" variant="primary" disabled={busy} onPress={() => void handleSubmit(onSave)()} />
  </View></SectionCard>;
}
