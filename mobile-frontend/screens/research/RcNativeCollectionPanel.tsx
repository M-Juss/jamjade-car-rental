import { Activity, ClipboardList, Database, RefreshCcw } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton, InfoRow, SectionCard } from '@/components/bookings';
import { KeyboardFormScrollView } from '@/components/common/KeyboardFormScrollView';
import { SelectWithLabel } from '@/components/common/SelectWithLabel';
import { AbbreviationGuide, ExerciseGuide } from '@/components/research/ExerciseGuide';
import { NativeRecordingDetails } from '@/components/research/NativeRecordingDetails';
import { floatingTabBarContentPadding } from '@/constants/layout';
import { themeColors } from '@/constants/theme';
import { CollectionSessionForm, CollectionSetupForm } from '@/forms/research/CollectionSetupForm';
import { NativeCollectionGroupForm } from '@/forms/research/NativeRecordingForm';
import { ObservationForm } from '@/forms/research/ObservationForm';
import { exerciseCatalog, recordingTitle, type CollectionState, type CollectionStatus, type ExerciseProtocol } from '@/lib/research/collection';
import { NATIVE_MOUNT_METHOD, type NativeRecorderState, type NativeRecording, type NativeCollectionGroup, type NativeGroupCatalog } from '@/lib/research/native-recorder';
import { formatRentalDate } from '@/lib/telematics/rental-card';
import { useAuth } from '@/providers/AuthProvider';
import { ApiError } from '@/services/http';
import { NativeRecorderError, nativeRecorder } from '@/services/telematics/native-recorder';
import type { ExerciseCode } from '@/validation/research/collection';
import type { NativeCollectionGroupInput } from '@/validation/research/native-recorder';

import type { RcResearchTab } from './RcResearchTabs';

export function RcNativeCollectionPanel({ active, mode, onRecordingChange }: { active: boolean; mode: RcResearchTab; onRecordingChange: (recording: boolean) => void }) {
  const { user } = useAuth(), insets = useSafeAreaInsets();
  const [state, setState] = useState<NativeRecorderState | null>(null), [records, setRecords] = useState<NativeRecording[]>([]);
  const [groups, setGroups] = useState<NativeGroupCatalog | null>(null), [collection, setCollection] = useState<CollectionState>({});
  const [selected, setSelected] = useState<NativeRecording | null>(null), [details, setDetails] = useState(false);
  const [sessionForm, setSessionForm] = useState(false), [groupForm, setGroupForm] = useState(false), [guide, setGuide] = useState<ExerciseProtocol | null>(null), [abbreviations, setAbbreviations] = useState(false);
  const [offset, setOffset] = useState(0), [filter, setFilter] = useState<'all' | 'current' | 'pilot'>('all');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [progress, setProgress] = useState<string | null>(null), [statuses, setStatuses] = useState<Record<string, CollectionStatus>>({}), [onlineStatus, setOnlineStatus] = useState(false);
  const mounted = useRef(true), working = useRef(false), querying = useRef<Promise<void> | null>(null), previousActive = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; void nativeRecorder.cancelCheck(); }; }, []);
  useEffect(() => { onRecordingChange(Boolean(state?.active || state?.checking)); }, [onRecordingChange, state?.active, state?.checking]);

  const refresh = useCallback(async (withList: boolean): Promise<void> => {
    if (!user || !nativeRecorder.available) return;
    if (querying.current) { if (withList) { await querying.current; return refresh(true); } return; }
    const task = (async () => {
      try {
        const next = await nativeRecorder.status(), ended = previousActive.current && !next.active;
        previousActive.current = next.active;
        if (mounted.current) { setState(next); if (ended && next.current) { setSelected(next.current); setDetails(false); } }
        if ((withList || ended) && !next.active) {
          const saved = await nativeRecorder.listCollection(offset, filter), catalog = await nativeRecorder.groups();
          const context = nativeRecorder.collectionAvailable && !next.active && !next.checking ? await nativeRecorder.collectionAction({ action: 'current' }) : null;
          if (!mounted.current) return;
          setRecords(saved); setGroups(catalog); if (context) setCollection(context);
          try {
            const result = await nativeRecorder.statuses(saved.filter(r => r.state !== 'unavailable').map(r => r.recording_id));
            if (mounted.current) { setStatuses(Object.fromEntries(result.map(r => [r.client_recording_id, r]))); setOnlineStatus(true); }
          } catch { if (mounted.current) { setStatuses({}); setOnlineStatus(false); } }
        }
      } catch { if (mounted.current) setError('Recorder access is unavailable. Connect and verify access again.'); }
      finally { if (mounted.current) setLoading(false); }
    })();
    querying.current = task;
    try { await task; } finally { querying.current = null; }
  }, [filter, offset, user]);

  useEffect(() => {
    if (!active || !user || !nativeRecorder.available) { setLoading(false); return; }
    let current = true;
    void (async () => { try { if (!nativeRecorder.isAuthorized(user.id)) await nativeRecorder.authorize(user.id); if (current) { setError(null); await refresh(true); } }
      catch { if (current) { setLoading(false); setError('Connect to verify research access.'); } } })();
    return () => { current = false; };
  }, [active, refresh, user]);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => { if (AppState.currentState === 'active' && user && nativeRecorder.isAuthorized(user.id)) void refresh(false); }, 1000);
    return () => clearInterval(timer);
  }, [active, refresh, user]);
  useEffect(() => { setSelected(null); setDetails(false); }, [mode]);

  const run = async (action: () => Promise<void>) => {
    if (working.current) return false;
    working.current = true; setBusy(true); setError(null);
    try { await action(); void refresh(true); return true; }
    catch (failure) {
      if (mounted.current) setError(failure instanceof ApiError && [401, 403].includes(failure.status) ? 'Research access expired. Sign in again.'
        : failure instanceof ApiError && failure.status === 409 ? 'Saved details conflict with the server. Refresh before retrying.'
          : failure instanceof ApiError && failure.status === 422 ? 'Collection details could not be verified. The original is kept; review setup and retry.'
            : failure instanceof NativeRecorderError ? failure.message : 'Action failed. Check access, sensors, notifications and storage. Your saved originals are kept.');
      return false;
    } finally { working.current = false; if (mounted.current) setBusy(false); }
  };
  const createGroup = async (values: NativeCollectionGroupInput) => {
    let result: NativeCollectionGroup | null = null;
    await run(async () => { result = await nativeRecorder.createGroup(values); setGroups(await nativeRecorder.groups()); setGroupForm(false); setSessionForm(true); });
    return result;
  };
  const start = async (code: ExerciseCode) => {
    const session = collection.session, evidence = state?.setup_check;
    if (!session || !evidence || !user) return;
    const protocol = exerciseCatalog.protocols.find(p => p.code === code)!;
    await run(async () => {
      await nativeRecorder.start(user.id, { recording_group_id: session.recording_group_id, surface: session.conditions.surface, slope: session.conditions.slope,
        mount_method: NATIVE_MOUNT_METHOD, recording_kind: protocol.recording_kind as 'maneuver_trial' | 'stationary_reference' | 'forward_reference',
        protocol_code: code, preflight_id: evidence.id, consent: true });
      setSelected(null);
    });
  };
  const stop = () => {
    if (stopping) return;
    setGuide(null); setStopping(true);
    // Stop never waits for a web request or the action queue.
    void nativeRecorder.stop().then(() => { void refresh(true); }).catch(() => {
      setError('Could not stop here. Use Stop in the recording notification.');
    }).finally(() => { if (mounted.current) setStopping(false); });
  };
  const upload = (record: NativeRecording) => {
    if (!user) return;
    Alert.alert('Upload recording & observations?', 'Send motion readings, setup checks, phone diagnostics and saved observations to your private Admin inspector. The phone original stays.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Upload', onPress: () => void run(async () => {
        setProgress('Uploading original…');
        try {
          await nativeRecorder.upload(user.id, record.recording_id, (sent, total) => setProgress(`Uploading ${sent}/${total || '…'}`));
          setProgress('Syncing collection details…');
          if (nativeRecorder.collectionAvailable) await nativeRecorder.syncCollection(record.recording_id);
          if (selected?.recording_id === record.recording_id) setSelected(await nativeRecorder.details(record.recording_id));
        } finally { setProgress(null); }
      }) },
    ]);
  };
  const current = state?.active ? state.current : selected;
  const currentProtocol = current?.collection?.protocol_snapshot;
  const group = groups?.groups.find(g => g.id === collection.session?.recording_group_id);
  const latest = current?.collection?.observations?.at(-1);

  return <View className="flex-1">
    <View className="w-full max-w-[640px] flex-row items-center justify-between self-center px-screen pb-3">
      <Text accessibilityRole="header" className="font-sans text-section font-semibold text-foreground">{mode === 'collect' ? 'Collect' : 'Recordings'}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Refresh recordings" disabled={busy} className="min-h-control min-w-control items-center justify-center" onPress={() => void refresh(true)}><RefreshCcw size={20} color={themeColors.primary} /></Pressable>
    </View>
    <KeyboardFormScrollView contentContainerClassName="w-full max-w-[640px] self-center px-screen pt-1" contentContainerStyle={{ paddingBottom: floatingTabBarContentPadding + insets.bottom }}>
      <View className="gap-4">
        {loading && <ActivityIndicator accessibilityLabel="Loading recorder" color={themeColors.primary} />}
        {error && <View className="gap-3"><Text accessibilityRole="alert" className="font-sans text-body text-destructive">{error}</Text><ActionButton label="Verify access" disabled={busy} onPress={() => void run(async () => { if (user) await nativeRecorder.authorize(user.id); })} /></View>}
        {!nativeRecorder.collectionAvailable && <SectionCard title="Android update required" icon={Activity}><Text className="font-sans text-body text-secondary-foreground">Install the updated standalone APK for guided collection. Existing phone recordings are kept.</Text></SectionCard>}
        {state?.error && <Text accessibilityRole="alert" className="font-sans text-body text-destructive">{state.error}</Text>}
        {state?.active && <SectionCard title={state.preparing ? 'Preparing sensors' : recordingTitle(state.current ?? {})} icon={Activity}>
          <Text accessibilityLiveRegion="polite" className="font-sans mb-3 text-section font-semibold text-foreground">{((state.current?.duration_ms ?? 0) / 1000).toFixed(1)} s</Text>
          {currentProtocol && <><Text className="font-sans mb-3 text-body text-foreground">Rest ~5 s → {currentProtocol.steps.find(s => s.stage === 'exercise')?.instruction} → settle & rest ~5 s</Text><ActionButton label="View protocol" onPress={() => setGuide(currentProtocol)} /></>}
          <View className="mt-3"><ActionButton label={stopping ? 'Saving…' : 'Stop & save'} variant="primary" disabled={stopping} onPress={stop} /></View>
        </SectionCard>}
        {mode === 'collect' && !state?.active && !selected && groups && nativeRecorder.collectionAvailable && <>
          {groupForm ? <NativeCollectionGroupForm disabled={busy} catalog={groups} onCreate={async values => { await createGroup(values); }} onCancel={() => setGroupForm(false)} />
            : !collection.session || !collection.mount || sessionForm ? <CollectionSessionForm catalog={groups} busy={busy} onOpen={async id => { await run(async () => { setCollection(await nativeRecorder.collectionAction({ action: 'open', group_id: id })); setSessionForm(false); setSelected(null); }); }} onNewGroup={() => setGroupForm(true)} onCancel={collection.session ? () => setSessionForm(false) : undefined} />
              : <CollectionSetupForm collection={collection} nextNumber={group?.next_recording_number ?? 1} busy={busy} checking={state?.checking ?? false} evidence={state?.setup_check} phonePower={state?.phone_power}
                onNewSession={() => setSessionForm(true)} onRemount={() => Alert.alert('Declare a new mount?', 'This keeps the session and requires fresh setup checks and a forward reference.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Phone remounted', onPress: () => void run(async () => { setCollection(await nativeRecorder.collectionAction({ action: 'mount', reason: 'remounted' })); }) }])}
                onCheck={async () => { await run(() => nativeRecorder.beginCheck()); }} onStart={start} />}
        </>}
        {current && !state?.active && <View className="gap-3">
          <SectionCard title={recordingTitle(current)} icon={ClipboardList}><InfoRow label="Original" value={`${((current.duration_ms ?? 0) / 1000).toFixed(1)} s · ${current.state}`} />
            <ActionButton label={details ? 'Hide sensor details' : 'Sensor details'} onPress={() => setDetails(v => !v)} />
            {currentProtocol && <View className="mt-2"><ActionButton label="View saved protocol" onPress={() => setGuide(currentProtocol)} /></View>}
          </SectionCard>
          {current.collection && <ObservationForm key={`${current.recording_id}-${latest?.revision ?? 0}`} latest={latest} disabled={busy}
            onSave={async values => { await run(async () => { await nativeRecorder.saveObservation(current.recording_id, values); setSelected(await nativeRecorder.details(current.recording_id)); }); }} />}
          {details && <NativeRecordingDetails recording={current} />}
          <ActionButton label="Close recording" disabled={busy} onPress={() => setSelected(null)} />
        </View>}
        {mode === 'recordings' && <SectionCard title="On this phone" icon={Database}><View className="gap-3">
          <ActionButton label="Abbreviation guide" onPress={() => setAbbreviations(true)} />
          <SelectWithLabel label="Collection" value={filter} onValueChange={v => { setOffset(0); setFilter(v as typeof filter); }} options={[{ value: 'all', label: 'All recordings' }, { value: 'current', label: 'Current collection' }, { value: 'pilot', label: 'Pilot history' }]} disabled={busy} />
          <Text className="font-sans text-caption text-secondary-foreground">{onlineStatus ? 'Server status checked' : 'Server status unavailable · saved receipts shown'}</Text>
          {!records.length && <Text className="font-sans text-body text-secondary-foreground">No recordings on this page.</Text>}
          {records.map(record => {
            const server = statuses[record.recording_id], cache = record.collection?.sync;
            const observationCount = record.collection?.observations?.length ?? 0;
            const labels = server ? server.annotation_state : cache ? `${cache.annotation_state} (cached)` : 'Unavailable';
            return <View key={record.recording_id} className="gap-2 border-b border-border pb-4">
              <Pressable accessibilityRole="button" disabled={busy || Boolean(state?.active)} onPress={() => void run(async () => { setSelected(await nativeRecorder.details(record.recording_id)); setDetails(false); })}>
                <Text className="font-sans text-body font-semibold text-primary">{recordingTitle(record)}</Text>
                <Text className="font-sans mt-1 text-caption text-secondary-foreground">{record.started_at_utc ? formatRentalDate(record.started_at_utc) : 'Time unavailable'} · {((record.duration_ms ?? 0) / 1000).toFixed(1)} s</Text>
              </Pressable>
              <Text className="font-sans text-caption text-secondary-foreground">{record.transfer_state === 'uploaded' ? 'Original verified (saved receipt)' : record.transfer_state === 'upload_failed' ? 'Original upload incomplete' : 'Original on phone'}{record.collection ? ' · Pilot' : ' · Pilot history'}</Text>
              <Text className="font-sans text-caption text-secondary-foreground">Labels · {labels}</Text>
              {record.collection_error && <Text className="font-sans text-caption text-destructive">Collection details cannot be read. Original retained.</Text>}
              {record.collection && <Text className="font-sans text-caption text-secondary-foreground">{server?.context_synced || cache?.context_synced ? 'Setup synced' : 'Setup pending sync'} · {observationCount === 0 ? 'Observations not recorded' : (server?.observation_revision ?? 0) > observationCount ? 'Newer observations on server · review needed' : `Observations ${cache?.observation_revision ?? 0}/${observationCount} synced`}</Text>}
              {['stopped', 'interrupted'].includes(record.state) && nativeRecorder.uploadAvailable && <ActionButton label={busy && progress ? progress : record.transfer_state === 'uploaded' ? 'Sync & verify' : 'Upload recording'} disabled={busy || Boolean(state?.active || state?.checking)} onPress={() => upload(record)} />}
              {!['recording', 'preparing'].includes(record.state) && <ActionButton label="Delete phone copy" variant="danger" disabled={busy || Boolean(state?.active)} onPress={() => Alert.alert('Delete phone copy?', 'Permanently removes this original and its local observations. Server copies are kept. Unuploaded data cannot be recovered.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void run(async () => { await nativeRecorder.remove(record.recording_id); setSelected(null); }) }])} />}
            </View>;
          })}
          <View className="flex-row gap-3"><ActionButton className="flex-1" label="Previous" disabled={offset === 0 || busy} onPress={() => setOffset(v => Math.max(0, v - 10))} /><ActionButton className="flex-1" label="Next" disabled={records.length < 10 || offset >= 90 || busy} onPress={() => setOffset(v => v + 10)} /></View>
        </View></SectionCard>}
      </View>
    </KeyboardFormScrollView>
    <ExerciseGuide protocol={guide} onClose={() => setGuide(null)} onStop={state?.active ? stop : undefined} />
    <AbbreviationGuide visible={abbreviations} onClose={() => setAbbreviations(false)} />
  </View>;
}
