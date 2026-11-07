import { zodResolver } from '@hookform/resolvers/zod';
import { ClipboardList } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Text, View } from 'react-native';

import { ActionButton, InfoRow, SectionCard } from '@/components/bookings';
import { SelectWithLabel } from '@/components/common/SelectWithLabel';
import { NATIVE_MOUNT_METHOD, NATIVE_RECORDING_PURPOSES, nativeCollectionGroupName, type NativeCollectionGroup, type NativeGroupCatalog, type NativePhonePower } from '@/lib/research/native-recorder';
import { RC_SLOPES, RC_SURFACES } from '@/lib/research/rc-research';
import { nativeCollectionGroupFormSchema, nativeRecordingSchema, type NativeCollectionGroupInput, type NativeRecordingInput } from '@/validation/research/native-recorder';

const surfaces = [...RC_SURFACES.filter(option => option.value !== 'Other'), { value: 'Tiles', label: 'Tiles' }, { value: 'Other', label: 'Other' }];
type Props = {
  disabled: boolean; catalog: NativeGroupCatalog; onStart: (values: NativeRecordingInput) => Promise<void>;
  onCreateGroup: (values: NativeCollectionGroupInput) => Promise<NativeCollectionGroup | null>; initialValues?: NativeRecordingInput;
  phonePower?: NativePhonePower;
};

export function NativeRecordingForm({ disabled, catalog, onStart, onCreateGroup, initialValues, phonePower }: Props) {
  const initialGroup = catalog.groups.find(group => group.id === initialValues?.recording_group_id)
    ?? catalog.groups.find(group => group.id === catalog.selected_group_id) ?? catalog.groups[0];
  const [creating, setCreating] = useState(!catalog.groups.length);
  const { control, handleSubmit, setValue, clearErrors, formState: { errors, isSubmitting } } = useForm<NativeRecordingInput>({
    resolver: zodResolver(nativeRecordingSchema),
    defaultValues: { recording_group_id: initialGroup?.id ?? '', surface: initialGroup?.defaults.surface ?? '',
      slope: initialGroup?.defaults.slope ?? 'level',
      recording_kind: initialGroup?.defaults.recording_kind ?? 'maneuver_trial', ...initialValues, mount_method: NATIVE_MOUNT_METHOD, consent: false },
  });
  const groupId = useWatch({ control, name: 'recording_group_id' });
  const selected = catalog.groups.find(group => group.id === groupId);
  const busy = disabled || isSubmitting;
  useEffect(() => {
    if (!selected && initialGroup) {
      setValue('recording_group_id', initialGroup.id);
      setValue('surface', initialGroup.defaults.surface);
      setValue('slope', initialGroup.defaults.slope);
      setValue('recording_kind', initialGroup.defaults.recording_kind);
    }
  }, [initialGroup, selected, setValue]);
  const choose = (group: NativeCollectionGroup) => {
    setValue('recording_group_id', group.id);
    setValue('surface', group.defaults.surface);
    setValue('slope', group.defaults.slope);
    setValue('recording_kind', group.defaults.recording_kind);
    setValue('consent', false); clearErrors();
  };
  if (creating) return <NativeCollectionGroupForm disabled={disabled} catalog={catalog} phonePower={phonePower}
    onCancel={catalog.groups.length ? () => setCreating(false) : undefined}
    onCreate={async values => {
      const group = await onCreateGroup(values);
      if (group) { choose(group); setCreating(false); }
    }} />;
  return <View className="gap-4"><SectionCard density="compact" title="Recording setup" icon={ClipboardList}><View className="gap-4">
    <Controller control={control} name="recording_group_id" render={({ field, fieldState }) => <SelectWithLabel label="Collection group" required
      options={catalog.groups.map(group => ({ value: group.id, label: group.name }))} value={field.value}
      onValueChange={id => { const group = catalog.groups.find(item => item.id === id); if (group) choose(group); }}
      disabled={busy} error={fieldState.error?.message} />} />
    <ActionButton density="compact" label="New collection group" disabled={busy} onPress={() => setCreating(true)} />
    <PresetDetails catalog={catalog} phonePower={phonePower} />
    {selected && <InfoRow label="Next recording" value={`Recording ${String(selected.next_recording_number).padStart(3, '0')}`} />}
    <Controller control={control} name="surface" render={({ field, fieldState }) => <SelectWithLabel label="Surface" required options={surfaces}
      value={field.value} onValueChange={field.onChange} disabled={busy} error={fieldState.error?.message} />} />
    <Controller control={control} name="slope" render={({ field, fieldState }) => <SelectWithLabel label="Slope" required options={RC_SLOPES}
      value={field.value} onValueChange={field.onChange} disabled={busy} error={fieldState.error?.message} />} />
    <Controller control={control} name="recording_kind" render={({ field, fieldState }) => <SelectWithLabel label="Recording purpose" required value={field.value}
      onValueChange={field.onChange} disabled={busy} error={fieldState.error?.message} options={NATIVE_RECORDING_PURPOSES} />} />
    <Text className="font-sans text-caption text-secondary-foreground">Records motion and phone battery status locally, including while the screen is locked. Stop here or from the notification. Upload saved recordings separately for Admin review.</Text>
    {errors.consent && <Text accessibilityRole="alert" className="font-sans text-caption text-destructive">{errors.consent.message}</Text>}
  </View></SectionCard><ActionButton density="compact" label={busy ? 'Preparing…' : 'Agree & start recording'} variant="primary" disabled={busy}
    onPress={() => { setValue('consent', true); void handleSubmit(onStart)(); }} /></View>;
}

function PresetDetails({ catalog, phonePower }: { catalog: NativeGroupCatalog; phonePower?: NativePhonePower }) {
  return <View><InfoRow label="Setup preset" value={catalog.preset.label} />
    <InfoRow label="RC model" value={catalog.preset.rc_model} />
    <InfoRow label="Mount method" value={NATIVE_MOUNT_METHOD} />
    <InfoRow label="Phone orientation" value="Tilted, screen up, top toward RC front" />
    {phonePower && <>
      <InfoRow label="Phone battery" value={phonePower.battery_percent == null ? 'Unavailable' : `${phonePower.battery_percent.toFixed(0)}%`} />
      <InfoRow label="Charging" value={phonePower.charging == null ? 'Unavailable' : phonePower.charging ? 'Yes' : 'No'} />
      <InfoRow label="Battery Saver" value={phonePower.battery_saver == null ? 'Unavailable' : phonePower.battery_saver ? 'On' : 'Off'} />
    </>}
  </View>;
}

export function NativeCollectionGroupForm({ disabled, catalog, onCancel, onCreate }: {
  disabled: boolean; catalog: NativeGroupCatalog; onCancel?: () => void; onCreate: (values: NativeCollectionGroupInput) => Promise<void>;
  phonePower?: NativePhonePower;
}) {
  const { control, handleSubmit, formState: { isSubmitting } } = useForm<NativeCollectionGroupInput>({
    resolver: zodResolver(nativeCollectionGroupFormSchema), defaultValues: { surface: '', slope: 'level', mount_method: NATIVE_MOUNT_METHOD, recording_kind: 'maneuver_trial' },
  });
  const surface = useWatch({ control, name: 'surface' });
  const slope = useWatch({ control, name: 'slope' });
  const name = nativeCollectionGroupName({ surface, slope }, catalog.groups);
  const busy = disabled || isSubmitting;
  return <SectionCard density="compact" title="New collection group" icon={ClipboardList}><View className="gap-4">
    <Controller control={control} name="surface" render={({ field, fieldState }) => <SelectWithLabel label="Surface" required options={surfaces}
      value={field.value} onValueChange={field.onChange} disabled={busy} error={fieldState.error?.message} />} />
    <Controller control={control} name="slope" render={({ field, fieldState }) => <SelectWithLabel label="Slope" required options={RC_SLOPES}
      value={field.value} onValueChange={field.onChange} disabled={busy} error={fieldState.error?.message} />} />
    <InfoRow label="Name" value={name || 'Select a surface'} />
    <ActionButton density="compact" label={busy ? 'Creating…' : 'Create group'} variant="primary" disabled={busy} onPress={() => void handleSubmit(onCreate)()} />
    {onCancel && <ActionButton density="compact" label="Cancel" disabled={busy} onPress={onCancel} />}
  </View></SectionCard>;
}
