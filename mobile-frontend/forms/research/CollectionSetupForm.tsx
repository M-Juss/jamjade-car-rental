import { zodResolver } from '@hookform/resolvers/zod';
import { ClipboardList, Gauge } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';

import { ActionButton, InfoRow, SectionCard } from '@/components/bookings';
import { SelectWithLabel } from '@/components/common/SelectWithLabel';
import { ExerciseGuide } from '@/components/research/ExerciseGuide';
import { exerciseCatalog, type CollectionState, type ExerciseProtocol, type SetupEvidence } from '@/lib/research/collection';
import type { NativeGroupCatalog, NativePhonePower } from '@/lib/research/native-recorder';
import { collectionExerciseFormSchema, collectionSessionFormSchema, type ExerciseCode } from '@/validation/research/collection';

export function CollectionSessionForm({ catalog, busy, onOpen, onNewGroup, onCancel }: {
  catalog: NativeGroupCatalog; busy: boolean; onOpen: (id: string) => Promise<void>; onNewGroup: () => void; onCancel?: () => void;
}) {
  const { control, handleSubmit, formState: { isSubmitting } } = useForm<{ group_id: string }>({ resolver: zodResolver(collectionSessionFormSchema),
    defaultValues: { group_id: catalog.selected_group_id ?? catalog.groups[0]?.id ?? '' } });
  return <SectionCard title="Start a session" icon={ClipboardList}><View className="gap-4">
    <Controller control={control} name="group_id" render={({ field, fieldState }) => <SelectWithLabel label="Collection group" value={field.value} options={catalog.groups.map(group => ({ value: group.id, label: group.name }))}
      onValueChange={field.onChange} disabled={busy || isSubmitting} error={fieldState.error?.message} />} />
    <ActionButton label="Open session" variant="primary" disabled={busy || isSubmitting} onPress={() => void handleSubmit(v => onOpen(v.group_id))()} />
    <ActionButton label="New group" disabled={busy} onPress={onNewGroup} />
    {onCancel && <ActionButton label="Keep current session" disabled={busy} onPress={onCancel} />}
  </View></SectionCard>;
}

export function CollectionSetupForm({ collection, nextNumber, busy, checking, evidence, phonePower, onCheck, onStart, onRemount, onNewSession }: {
  collection: CollectionState; nextNumber: number; busy: boolean; checking: boolean; evidence?: SetupEvidence | null; phonePower?: NativePhonePower;
  onCheck: () => Promise<void>; onStart: (code: ExerciseCode) => Promise<void>; onRemount: () => void; onNewSession: () => void;
}) {
  const [references, setReferences] = useState(false), [confirmed, setConfirmed] = useState(false), [guide, setGuide] = useState<ExerciseProtocol | null>(null);
  const { control, watch, setValue, handleSubmit } = useForm<{ protocol_code: ExerciseCode }>({ resolver: zodResolver(collectionExerciseFormSchema), defaultValues: { protocol_code: 'FSS' } });
  const selectedCode = watch('protocol_code');
  const protocol = exerciseCatalog.protocols.find(p => p.code === selectedCode)!;
  useEffect(() => { setConfirmed(false); }, [collection.mount?.id]);
  const session = collection.session, mount = collection.mount;
  if (!session || !mount) return null;
  const validEvidence = evidence?.mount_version_id === mount.id ? evidence : null;
  return <View className="gap-4">
    <SectionCard title={`Session ${String(session.session_number).padStart(2, '0')} · Mount ${mount.mount_number}`} icon={ClipboardList}>
      <InfoRow label="Conditions" value={`${session.conditions.surface} · ${session.conditions.slope}`} />
      <InfoRow label="Phone" value="Redmi Note 8 Pro" />
      <InfoRow label="Mount" value="Roof · Adjustable screw" />
      {phonePower && <InfoRow label="Phone battery" value={`${phonePower.battery_percent ?? '—'}%${phonePower.battery_saver ? ' · Battery Saver on' : ''}`} />}
      <View className="mt-3 gap-2"><ActionButton label="Phone remounted / moved" disabled={busy || checking} onPress={onRemount} /><ActionButton label="New session" disabled={busy || checking} onPress={onNewSession} /></View>
    </SectionCard>
    <SectionCard title="1. Choose exercise" icon={ClipboardList}><View className="gap-4">
      <SelectWithLabel label="Purpose" options={[{ value: 'maneuver', label: 'Maneuver trial' }, { value: 'reference', label: 'Setup reference' }]} value={references ? 'reference' : 'maneuver'} disabled={busy || checking}
        onValueChange={value => { const next = value === 'reference'; setReferences(next); setValue('protocol_code', next ? 'FR' : 'FSS'); }} />
      <Controller control={control} name="protocol_code" render={({ field, fieldState }) => <SelectWithLabel label="Planned exercise" value={field.value} onValueChange={field.onChange} disabled={busy || checking} error={fieldState.error?.message}
        options={exerciseCatalog.protocols.filter(p => references ? p.recording_kind !== 'maneuver_trial' : p.recording_kind === 'maneuver_trial').map(p => ({ value: p.code, label: `${p.code} · ${p.label}` }))} />} />
      <InfoRow label="Next recording" value={`S${String(session.session_number).padStart(2, '0')}-${selectedCode}-R${String(nextNumber).padStart(3, '0')}`} />
      <ActionButton label="View protocol & course" onPress={() => setGuide(protocol)} />
    </View></SectionCard>
    <SectionCard title="2. Check setup" icon={Gauge}><View className="gap-3">
      <Text className="font-sans text-body text-foreground">Screen up, camera/notch toward the RC front. Keep the RC still on the setup area.</Text>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed, disabled: busy || checking }} disabled={busy || checking}
        className="min-h-control flex-row items-center gap-3 rounded-field border border-border px-3 py-3" onPress={() => setConfirmed(v => !v)}>
        <Text className="font-sans text-body font-semibold text-primary">{confirmed ? '☑' : '☐'}</Text><Text className="font-sans flex-1 text-body text-foreground">Holder locked, phone top forward, RC still</Text>
      </Pressable>
      <Text className="font-sans text-caption text-secondary-foreground">This check measures motion for five seconds. No recording or upload starts.</Text>
      <ActionButton label={checking ? 'Checking… keep still' : 'Agree & check setup'} disabled={busy || checking || !confirmed} onPress={() => void onCheck()} />
      {validEvidence && <View className="gap-2 border-t border-border pt-3">
        <Text accessibilityLiveRegion="polite" className={`font-sans text-body font-semibold ${validEvidence.result === 'failed' ? 'text-destructive' : 'text-warning'}`}>{validEvidence.result === 'failed' ? 'Check failed · retry before recording' : 'Measured · pilot only'}</Text>
        <InfoRow label="Delivered rate" value={`Accel ${validEvidence.measurements.accelerometer.rate_hz?.toFixed(1) ?? '—'} · Gyro ${validEvidence.measurements.gyroscope.rate_hz?.toFixed(1) ?? '—'} Hz`} />
        <InfoRow label="Gyro RMS" value={`${validEvidence.measurements.gyroscope.rms?.toFixed(4) ?? '—'} rad/s`} />
        <Text className="font-sans text-caption text-secondary-foreground">Tilt and stability limits are unvalidated. Alignment remains pending; keep a forward reference for this mount.</Text>
      </View>}
    </View></SectionCard>
    <Text className="font-sans text-caption text-secondary-foreground">Recording saves motion and phone diagnostics locally, including with the screen locked. Upload is separate.</Text>
    <ActionButton label="Agree & start pilot recording" variant="primary" disabled={busy || checking || !confirmed || validEvidence?.result !== 'inconclusive'} onPress={() => void handleSubmit(v => onStart(v.protocol_code))()} />
    <ExerciseGuide protocol={guide} onClose={() => setGuide(null)} />
  </View>;
}
