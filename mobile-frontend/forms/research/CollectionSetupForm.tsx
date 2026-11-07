import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpen, Check, ClipboardList, Info, RefreshCcw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';

import { ActionButton, SectionCard } from '@/components/bookings';
import { SelectWithLabel } from '@/components/common/SelectWithLabel';
import { MetadataList } from '@/components/common/MetadataList';
import { ResearchIconButton } from '@/components/research/ResearchControls';
import { themeColors } from '@/constants/theme';
import { ExerciseGuide } from '@/components/research/ExerciseGuide';
import { exerciseCatalog, type CollectionState, type ExerciseProtocol, type SetupEvidence } from '@/lib/research/collection';
import type { NativeGroupCatalog, NativePhonePower } from '@/lib/research/native-recorder';
import { collectionExerciseFormSchema, collectionSessionFormSchema, type ExerciseCode } from '@/validation/research/collection';

export function CollectionSessionForm({ catalog, collection, initialGroupId, busy, onOpen, onNewSession, onNewGroup }: {
  catalog: NativeGroupCatalog; collection: CollectionState; initialGroupId: string | null; busy: boolean; onOpen: (id: string) => Promise<void>; onNewSession: (id: string) => void; onNewGroup: () => void;
}) {
  const { control, handleSubmit, watch, formState: { isSubmitting } } = useForm<{ group_id: string }>({ resolver: zodResolver(collectionSessionFormSchema),
    defaultValues: { group_id: initialGroupId ?? collection.session?.recording_group_id ?? catalog.selected_group_id ?? catalog.groups[0]?.id ?? '' } });
  const groupId = watch('group_id');
  const latest = collection.group_sessions?.[groupId];
  const currentGroup = catalog.groups.find(group => group.id === collection.session?.recording_group_id);
  return <SectionCard density="compact" title="Collection" icon={ClipboardList}><View className="gap-3">
    {collection.session && <View className="gap-1 border-b border-border pb-3">
      <Text className="font-sans text-caption text-secondary-foreground">Active collection</Text>
      <Text className="font-sans text-body font-semibold text-foreground">{currentGroup?.name ?? 'Group unavailable'}</Text>
      <Text className="font-sans text-caption text-secondary-foreground">Session S{String(collection.session.session_number).padStart(2, '0')}</Text>
    </View>}
    <Controller control={control} name="group_id" render={({ field, fieldState }) => <SelectWithLabel label="Group" value={field.value} options={catalog.groups.map(group => ({ value: group.id, label: group.name }))}
      onValueChange={field.onChange} disabled={busy || isSubmitting} error={fieldState.error?.message} />} />
    <Text className="font-sans text-caption text-secondary-foreground">{latest
      ? `Latest session S${String(latest.session.session_number).padStart(2, '0')} · ${latest.session_has_recordings ? 'Has recordings' : 'No recordings yet'}`
      : 'No session yet'}</Text>
    <ActionButton density="compact" label={latest ? `Continue session ${String(latest.session.session_number).padStart(2, '0')}` : 'Create session'} variant="primary" disabled={busy || isSubmitting} onPress={() => void handleSubmit(v => onOpen(v.group_id))()} />
    <View className="flex-row gap-2">
      <View className="flex-1"><ActionButton density="compact" label="Create group" disabled={busy || isSubmitting} onPress={onNewGroup} /></View>
      {latest && <View className="flex-1"><ActionButton density="compact" label="New session" disabled={busy || isSubmitting || !latest.session_has_recordings} onPress={() => onNewSession(groupId)} /></View>}
    </View>
  </View></SectionCard>;
}

export function CollectionSetupForm({ collection, groupName, nextNumber, busy, checking, evidence, phonePower, onNotes, onCheck, onStart }: {
  collection: CollectionState; groupName: string; nextNumber: number; busy: boolean; checking: boolean; evidence?: SetupEvidence | null; phonePower?: NativePhonePower;
  onNotes: () => void; onCheck: () => Promise<void>; onStart: (code: ExerciseCode) => Promise<void>;
}) {
  const [references, setReferences] = useState(!collection.forward_reference_recorded), [confirmed, setConfirmed] = useState(false), [guide, setGuide] = useState<ExerciseProtocol | null>(null);
  const { control, watch, setValue, handleSubmit } = useForm<{ protocol_code: ExerciseCode }>({ resolver: zodResolver(collectionExerciseFormSchema), defaultValues: { protocol_code: collection.forward_reference_recorded ? 'FSS' : 'FR' } });
  const selectedCode = watch('protocol_code');
  const protocol = exerciseCatalog.protocols.find(p => p.code === selectedCode)!;
  useEffect(() => { setConfirmed(false); }, [collection.mount?.id]);
  const session = collection.session, mount = collection.mount;
  if (!session || !mount) return null;
  const validEvidence = evidence?.mount_version_id === mount.id ? evidence : null;
  const measured = !checking && validEvidence?.result === 'inconclusive';
  const needsReference = protocol.recording_kind === 'maneuver_trial' && !collection.forward_reference_recorded;
  return <View className="gap-3">
    <View className="flex-row items-start gap-1">
      <View className="min-w-0 flex-1">
        <Text className="font-sans mb-1 text-body font-semibold text-foreground">{groupName}</Text>
        <MetadataList items={[
          { label: 'Active session', value: `S${String(session.session_number).padStart(2, '0')}` },
          { label: 'Mount', value: mount.mount_number },
        ]} />
      </View>
      <ResearchIconButton icon={Info} label="Research notes" onPress={onNotes} />
    </View>
    <SectionCard density="compact" title={`S${String(session.session_number).padStart(2, '0')}-${selectedCode}-R${String(nextNumber).padStart(3, '0')}`} icon={ClipboardList}>
      <View className="gap-3">
        {!collection.forward_reference_recorded && <Text className="font-sans text-caption text-warning">Capture a forward reference for this mount before a maneuver trial.</Text>}
        <SelectWithLabel label="Purpose" options={[{ value: 'maneuver', label: 'Maneuver trial' }, { value: 'reference', label: 'Setup reference' }]} value={references ? 'reference' : 'maneuver'} disabled={busy || checking}
          onValueChange={value => { const next = value === 'reference'; setReferences(next); setValue('protocol_code', next ? 'FR' : 'FSS'); }} />
        <Controller control={control} name="protocol_code" render={({ field, fieldState }) => <SelectWithLabel label="Exercise" value={field.value} onValueChange={field.onChange} disabled={busy || checking} error={fieldState.error?.message}
          options={exerciseCatalog.protocols.filter(p => references ? p.recording_kind !== 'maneuver_trial' : p.recording_kind === 'maneuver_trial').map(p => ({ value: p.code, label: p.label, description: p.code }))} />} />
        <Pressable accessibilityRole="button" onPress={() => setGuide(protocol)} className="min-h-control flex-row items-center gap-2">
          <BookOpen size={18} color={themeColors.primary} /><Text className="font-sans text-body font-semibold text-primary">Protocol & course</Text>
        </Pressable>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed, disabled: busy || checking }} disabled={busy || checking}
          className="min-h-control flex-row items-center gap-3 border-t border-border py-3" onPress={() => setConfirmed(v => !v)}>
          <View className={`h-6 w-6 items-center justify-center rounded-md border ${confirmed ? 'border-primary bg-primary' : 'border-border bg-surface'}`}>{confirmed && <Check size={16} color={themeColors.surface} />}</View>
          <Text className="font-sans flex-1 text-body text-foreground">Holder locked, top facing forward, and RC still.</Text>
        </Pressable>
        {checking ? <Text accessibilityLiveRegion="polite" className="font-sans text-body text-primary">Checking… keep still</Text> : validEvidence && <View className="flex-row items-center gap-2">
          <View className="min-w-0 flex-1">
            <Text accessibilityLiveRegion="polite" className={`font-sans text-caption font-medium ${measured ? 'text-warning' : 'text-destructive'}`}>{measured ? 'Measured' : 'Check failed'}</Text>
            <Text className="font-sans text-caption text-secondary-foreground">{measured ? 'Pilot only; alignment pending.' : 'Try again.'}</Text>
          </View>
          {measured && <ResearchIconButton icon={RefreshCcw} label="Repeat setup check" disabled={busy || !confirmed} onPress={() => void onCheck()} />}
        </View>}
        {phonePower?.battery_saver && <Text className="font-sans text-caption text-warning">Battery Saver is on.</Text>}
        <Text className="font-sans text-caption text-secondary-foreground">{measured ? 'Records motion and phone diagnostics locally, including with the screen locked.' : 'Measures motion for five seconds.'}</Text>
        <ActionButton density="compact" label={measured ? 'Agree & start recording' : checking ? 'Checking…' : 'Agree & check setup'} variant="primary" disabled={busy || checking || !confirmed || needsReference}
          onPress={() => { if (measured) void handleSubmit(v => onStart(v.protocol_code))(); else void onCheck(); }} />
      </View>
    </SectionCard>
    <ExerciseGuide protocol={guide} onClose={() => setGuide(null)} />
  </View>;
}
