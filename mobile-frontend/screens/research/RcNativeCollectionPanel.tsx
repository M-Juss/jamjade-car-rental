import { Activity, ArrowLeft, BookOpen, ChevronRight, Info, RefreshCcw, Settings2 } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton, InfoRow, SectionCard } from '@/components/bookings';
import { KeyboardFormScrollView } from '@/components/common/KeyboardFormScrollView';
import { RecordingLibrary } from '@/components/research/RecordingLibrary';
import { ResearchDialog, ResearchIconButton } from '@/components/research/ResearchControls';
import { ResearchNotes, ExerciseGuide } from '@/components/research/ExerciseGuide';
import { NativeRecordingDetails } from '@/components/research/NativeRecordingDetails';
import { RecordingSavedDialog } from '@/components/research/RecordingSavedDialog';
import { RecordingMetadata } from '@/components/research/RecordingMetadata';
import { floatingTabBarContentPadding } from '@/constants/layout';
import { themeColors } from '@/constants/theme';
import { CollectionSessionForm, CollectionSetupForm } from '@/forms/research/CollectionSetupForm';
import { NativeCollectionGroupForm } from '@/forms/research/NativeRecordingForm';
import { ObservationForm } from '@/forms/research/ObservationForm';
import { exerciseCatalog, recordingDisplay, type CollectionState, type CollectionStatus, type ExerciseProtocol } from '@/lib/research/collection';
import { NATIVE_MOUNT_METHOD, type NativeRecorderState, type NativeRecording, type NativeCollectionGroup, type NativeGroupCatalog } from '@/lib/research/native-recorder';
import { useAuth } from '@/providers/AuthProvider';
import { ApiError } from '@/services/http';
import { NativeRecorderError, nativeRecorder } from '@/services/telematics/native-recorder';
import type { ExerciseCode } from '@/validation/research/collection';
import type { NativeCollectionGroupInput } from '@/validation/research/native-recorder';

import type { RcResearchTab } from './RcResearchTabs';

export function RcNativeCollectionPanel({ active, mode, onCollect, onRecordingChange, onOpenedViewChange }: { onCollect: () => void; onOpenedViewChange: (opened: boolean) => void; active: boolean; mode: RcResearchTab; onRecordingChange: (recording: boolean) => void }) {
  const { user } = useAuth(), insets = useSafeAreaInsets();
  const [state, setState] = useState<NativeRecorderState | null>(null), [records, setRecords] = useState<NativeRecording[]>([]);
  const [groups, setGroups] = useState<NativeGroupCatalog | null>(null), [collection, setCollection] = useState<CollectionState>({});
  const [selected, setSelected] = useState<NativeRecording | null>(null), [details, setDetails] = useState(false);
  const [sessionForm, setSessionForm] = useState(true), [groupForm, setGroupForm] = useState(false), [guide, setGuide] = useState<ExerciseProtocol | null>(null), [notes, setNotes] = useState(false), [options, setOptions] = useState(false), [dirty, setDirty] = useState(false);
  const [sessionGroupId, setSessionGroupId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const statusRevision = useRef(0);
  const continueCollection = useRef(false);
  const [offset, setOffset] = useState(0), [filter, setFilter] = useState<'all' | 'current' | 'pilot'>('all');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [afterSave, setAfterSave] = useState<{ record: NativeRecording; uploaded: boolean } | null>(null);
  const [repeatExercise, setRepeatExercise] = useState<{ sessionId: string; mountId: string; code: ExerciseCode } | null>(null);
  const [progress, setProgress] = useState<{ id: string; label: string } | null>(null), [statuses, setStatuses] = useState<Record<string, CollectionStatus>>({}), [onlineStatus, setOnlineStatus] = useState(false);
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
        if ((withList || ended) && !next.active && !next.checking) {
          const page = nativeRecorder.pagingAvailable ? await nativeRecorder.collectionPage(offset, filter) : null;
          const saved = page?.records ?? await nativeRecorder.listCollection(offset, filter), catalog = await nativeRecorder.groups();
          const context = nativeRecorder.collectionAvailable ? await nativeRecorder.collectionAction({ action: 'current' }) : null;
          if (!mounted.current) return;
          setRecords(saved); setGroups(catalog); if (page) { setTotal(page.total); if (page.offset !== offset) setOffset(page.offset); } if (context) setCollection(context);
          const revision = ++statusRevision.current;
          setOnlineStatus(false);
          void nativeRecorder.statuses(saved.filter(r => r.state !== 'unavailable').map(r => r.recording_id)).then(result => {
            if (mounted.current && revision === statusRevision.current) { setStatuses(Object.fromEntries(result.map(r => [r.client_recording_id, r]))); setOnlineStatus(true); }
          }).catch(() => { if (mounted.current && revision === statusRevision.current) { setStatuses({}); setOnlineStatus(false); } });
        }
      } catch {
        if (mounted.current) {
          setState(current => current?.checking ? { ...current, checking: false, setup_progress: null } : current);
          setError('Recorder access is unavailable. Connect and verify access again.');
        }
      }
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
    const timer = setInterval(() => { if (AppState.currentState === 'active' && user && nativeRecorder.isAuthorized(user.id)) void refresh(false); }, state?.checking ? 100 : 1000);
    return () => clearInterval(timer);
  }, [active, refresh, state?.checking, user]);
  useEffect(() => {
    setSelected(null); setDetails(false); setDirty(false); setGroupForm(false);
    if (!continueCollection.current) setRepeatExercise(null);
    setSessionForm(!continueCollection.current); continueCollection.current = false;
    setSessionGroupId(null); setAfterSave(null);
  }, [mode]);

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
    await run(async () => { result = await nativeRecorder.createGroup(values); setSessionGroupId(result.id); setGroups(await nativeRecorder.groups()); setGroupForm(false); setSessionForm(true); });
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
  const performUpload = async (record: NativeRecording) => {
    if (!user) return false;
    return run(async () => {
      setProgress({ id: record.recording_id, label: 'Uploading…' });
      try {
        await nativeRecorder.upload(user.id, record.recording_id, (sent, total) => setProgress({ id: record.recording_id, label: `Uploading ${sent}/${total || '…'}` }));
        setProgress({ id: record.recording_id, label: 'Syncing…' });
        if (nativeRecorder.collectionAvailable) await nativeRecorder.syncCollection(record.recording_id);
        if (selected?.recording_id === record.recording_id) setSelected(await nativeRecorder.details(record.recording_id));
      } finally { setProgress(null); }
    });
  };
  const upload = (record: NativeRecording) => {
    if (!user) return;
    Alert.alert('Upload recording & observations?', 'Send motion readings, setup checks, phone diagnostics and saved observations to your private Admin inspector. The phone original stays.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Upload', onPress: () => void performUpload(record) },
    ]);
  };
  const current = state?.active ? state.current : selected;
  const currentProtocol = current?.collection?.protocol_snapshot;
  const group = groups?.groups.find(g => g.id === collection.session?.recording_group_id);
  const latest = current?.collection?.observations?.at(-1);
  const initialExercise = repeatExercise && repeatExercise.sessionId === collection.session?.id && repeatExercise.mountId === collection.mount?.id
    ? repeatExercise.code : undefined;

  const setupOpened = mode === 'collect' && Boolean(collection.session && collection.mount) && !sessionForm && !groupForm && !selected && !state?.active;
  const navigationBlocked = busy || Boolean(state?.active || state?.checking);
  const opened = Boolean(selected || groupForm || setupOpened || state?.active);
  const goBack = useCallback(() => {
    if (navigationBlocked) return;
    if (details) { setDetails(false); return; }
    const leave = () => {
      if (selected) { setSelected(null); setDirty(false); }
      else if (groupForm) { setGroupForm(false); setSessionForm(true); }
      else { setRepeatExercise(null); setSessionForm(true); }
    };
    if (dirty) Alert.alert('Discard unsaved observations?', 'The original recording is already saved.', [
      { text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: leave },
    ]); else leave();
  }, [navigationBlocked, details, dirty, groupForm, selected]);
  useEffect(() => { onOpenedViewChange(opened); }, [onOpenedViewChange, opened]);
  useEffect(() => {
    if (!active || !opened) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
    return () => listener.remove();
  }, [active, goBack, opened]);
  const remove = (record: NativeRecording) => Alert.alert('Delete phone copy?', 'Permanently removes this original and its local observations. Server copies stay. Unuploaded data cannot be recovered.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void run(async () => { await nativeRecorder.remove(record.recording_id); setSelected(null); setDirty(false); }) },
  ]);
  const remount = () => {
    setOptions(false);
    Alert.alert('Phone remounted?', 'Requires new setup checks and a fresh forward reference.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Confirm remount', onPress: () => void run(async () => { setCollection(await nativeRecorder.collectionAction({ action: 'mount', reason: 'remounted' })); }) },
    ]);
  };
  const newSession = (groupId = collection.session?.recording_group_id) => {
    if (!groupId) return;
    setOptions(false);
    const latest = collection.group_sessions?.[groupId];
    if (latest && !latest.session_has_recordings) {
      void run(async () => {
        setCollection(await nativeRecorder.collectionAction({ action: 'open', group_id: groupId }));
        setSessionGroupId(groupId); setSessionForm(false);
      });
      return;
    }
    const groupName = groups?.groups.find(group => group.id === groupId)?.name ?? 'Selected group';
    Alert.alert('Create a new session?', `${groupName}\nStarts a new collection block. Saved recordings stay in their original sessions.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Create session', onPress: () => void run(async () => {
        setCollection(await nativeRecorder.collectionAction({ action: 'new_session', group_id: groupId }));
        setSessionGroupId(groupId);
        setSessionForm(false);
      }) },
    ]);
  };

  return <View className="flex-1">
    <View className="w-full max-w-[640px] flex-row items-center gap-1 self-center px-screen">
      {opened ? <ResearchIconButton icon={ArrowLeft} label={details ? 'Back to recording' : selected ? mode === 'recordings' ? 'Back to recordings' : 'Back to collection' : 'Back to session selection'} onPress={goBack} disabled={navigationBlocked} /> : null}
      <View className="flex-1" />
      {!setupOpened && <ResearchIconButton icon={Info} label="Research notes" onPress={() => setNotes(true)} />}
      {!selected && !groupForm && !state?.active && <ResearchIconButton icon={RefreshCcw} label="Refresh recordings" disabled={busy} onPress={() => void refresh(true)} />}
      {setupOpened && <ResearchIconButton icon={Settings2} label="Session options" onPress={() => setOptions(true)} disabled={navigationBlocked} />}
    </View>
    <KeyboardFormScrollView key={selected ? `record-${selected.recording_id}` : groupForm ? 'group' : sessionForm ? 'session' : mode} contentContainerClassName="w-full max-w-[640px] self-center px-screen pt-1" contentContainerStyle={{ paddingBottom: opened ? insets.bottom + 20 : floatingTabBarContentPadding + insets.bottom }}>
      <View className="gap-2">
        {loading && <ActivityIndicator accessibilityLabel="Loading recorder" color={themeColors.primary} />}
        {error && <View className="gap-2"><Text accessibilityRole="alert" className="font-sans text-body text-destructive">{error}</Text><ActionButton density="compact" label="Verify access" disabled={busy} onPress={() => void run(async () => { if (user) await nativeRecorder.authorize(user.id); })} /></View>}
        {!nativeRecorder.collectionAvailable && <Text className="font-sans text-body text-secondary-foreground">Install the updated Android APK for guided collection.</Text>}
        {state?.error && <Text accessibilityRole="alert" className="font-sans text-body text-destructive">{state.error}</Text>}
        {state?.active && <SectionCard density="compact" title={state.preparing ? 'Preparing sensors' : recordingDisplay(state.current ?? {}).title} icon={Activity}>
          {state.current ? <RecordingMetadata recording={state.current} className="mb-3" /> : null}
          <Text accessibilityLiveRegion="polite" className="font-sans mb-3 text-title font-semibold text-foreground">{((state.current?.duration_ms ?? 0) / 1000).toFixed(1)} s</Text>
          {currentProtocol && <><Text className="font-sans mb-2 text-body text-foreground">Rest ~5 s → {currentProtocol.steps.find(s => s.stage === 'exercise')?.instruction} → settle & rest ~5 s</Text>
            <Pressable accessibilityRole="button" onPress={() => setGuide(currentProtocol)} className="min-h-control flex-row items-center gap-2"><BookOpen size={18} color={themeColors.primary} /><Text className="font-sans text-body font-semibold text-primary">Protocol</Text></Pressable></>}
          <ActionButton density="compact" label={stopping ? 'Saving…' : 'Stop & save'} variant="primary" disabled={stopping} onPress={stop} />
        </SectionCard>}
        {mode === 'collect' && !state?.active && !selected && groups && nativeRecorder.collectionAvailable && <>
          {groupForm ? <NativeCollectionGroupForm disabled={busy} catalog={groups} onCreate={async values => { await createGroup(values); }} />
            : !collection.session || !collection.mount || sessionForm ? <CollectionSessionForm catalog={groups} collection={collection} initialGroupId={sessionGroupId} busy={busy} onNewSession={newSession} onOpen={async id => { await run(async () => { setCollection(await nativeRecorder.collectionAction({ action: 'open', group_id: id })); setSessionGroupId(id); setSessionForm(false); }); }} onNewGroup={() => setGroupForm(true)} />
              : <CollectionSetupForm key={collection.mount?.id} collection={collection} groupName={group?.name ?? 'Group unavailable'} nextNumber={group?.next_recording_number ?? 1} initialExercise={initialExercise} busy={busy} checking={state?.checking ?? false} evidence={state?.setup_check} stillness={state?.setup_progress} checkError={state?.setup_check_error} phonePower={state?.phone_power}
                onNotes={() => setNotes(true)} onCheck={async () => { await run(() => nativeRecorder.beginCheck()); }}
                onCancelCheck={async () => { await run(() => nativeRecorder.cancelCheck()); }} onStart={start} />}
        </>}
        {current && !state?.active && <View>
          <View style={{ display: details ? 'none' : 'flex' }} className="gap-3">
          <SectionCard density="compact" title={recordingDisplay(current).title} icon={Activity}>
            <RecordingMetadata recording={current} className="mb-3" />
            <InfoRow label="Original" value={current.state} />
            <InfoRow label="Duration" value={`${((current.duration_ms ?? 0) / 1000).toFixed(1)} s`} />
            <InfoRow label="Upload" value={current.transfer_state === 'uploaded' ? <View className="items-end gap-0.5"><Text className="font-sans text-body font-medium text-foreground">Verified</Text><Text className="font-sans text-caption text-secondary-foreground">Saved receipt</Text></View> : current.transfer_state.replaceAll('_', ' ')} />
            <InfoRow label="Labels" value={statuses[current.recording_id]?.annotation_state ?? (current.collection?.sync ? <View className="items-end gap-0.5"><Text className="font-sans text-body font-medium text-foreground">{current.collection.sync.annotation_state}</Text><Text className="font-sans text-caption text-secondary-foreground">Cached</Text></View> : 'Unavailable')} />
            <Pressable accessibilityRole="button" onPress={() => setDetails(true)} className="min-h-control flex-row items-center gap-2 border-t border-border"><Text className="font-sans flex-1 text-body text-primary">Sensor & setup details</Text><ChevronRight size={18} color={themeColors.primary} /></Pressable>
            {currentProtocol && <Pressable accessibilityRole="button" onPress={() => setGuide(currentProtocol)} className="min-h-control flex-row items-center gap-2"><Text className="font-sans flex-1 text-body text-primary">Saved protocol</Text><ChevronRight size={18} color={themeColors.primary} /></Pressable>}
          </SectionCard>
          {current.collection && <ObservationForm key={current.recording_id} latest={latest} isSwerve={current.collection.protocol_code === 'SW'} disabled={busy} onDirtyChange={setDirty}
            onSave={async values => {
              if (working.current) throw new NativeRecorderError('Another action is finishing. Try again.');
              working.current = true; setBusy(true);
              try {
                const saved = await nativeRecorder.saveObservation(current.recording_id, values);
                const revision = saved.observations!.at(-1)!;
                setSelected(record => record?.recording_id === current.recording_id ? { ...record, collection: saved } : record);
                setDirty(false);
                setError(null); setAfterSave({ record: { ...current, collection: saved }, uploaded: false });
                void refresh(true);
                return revision;
              } finally { working.current = false; if (mounted.current) setBusy(false); }
            }} />}
          </View>
          {details && <NativeRecordingDetails recording={current} />}
        </View>}
        {mode === 'recordings' && !opened && (nativeRecorder.pagingAvailable ? <RecordingLibrary records={records} total={total} offset={offset} filter={filter} statuses={statuses} busy={busy} blocked={Boolean(state?.active || state?.checking)} progress={progress}
          onFilter={value => { statusRevision.current++; setOffset(0); setFilter(value); }} onPage={value => { statusRevision.current++; setOffset(value); }}
          onOpen={record => void run(async () => { setSelected(await nativeRecorder.details(record.recording_id)); setDetails(false); })} onUpload={upload} onDelete={remove} />
          : <Text className="font-sans text-body text-secondary-foreground">Install the updated Android APK for the recording library.</Text>)}
      </View>
    </KeyboardFormScrollView>
    <RecordingSavedDialog record={afterSave?.record ?? null} uploaded={afterSave?.uploaded ?? false} busy={busy}
      error={error}
      progress={progress?.id === afterSave?.record.recording_id ? progress?.label : undefined}
      onClose={() => setAfterSave(null)}
      onAnother={() => {
        const saved = afterSave?.record.collection;
        setRepeatExercise(saved?.protocol_snapshot.recording_kind === 'maneuver_trial'
          ? { sessionId: saved.session.id, mountId: saved.mount.id, code: saved.protocol_code } : null);
        setAfterSave(null); setSelected(null); setDetails(false); setDirty(false); setSessionForm(false); setGroupForm(false);
        if (mode !== 'collect') { continueCollection.current = true; onCollect(); }
      }}
      onUpload={() => { if (afterSave) void performUpload(afterSave.record).then(ok => {
        if (ok && mounted.current) setAfterSave(value => value?.record.recording_id === afterSave.record.recording_id ? { ...value, uploaded: true } : value);
      }); }} />
    <ExerciseGuide protocol={guide} onClose={() => setGuide(null)} onStop={state?.active ? stop : undefined} />
    <ResearchNotes visible={notes} onClose={() => setNotes(false)} onReset={!busy && !state?.active && !state?.checking ? () => {
      Alert.alert('Delete local research data?', 'Permanently deletes this account’s recordings, observations, groups and sessions on this phone. Server copies are separate. This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete permanently', style: 'destructive', onPress: () => void run(async () => {
          await nativeRecorder.collectionAction({ action: 'reset_local_research', confirmation: 'DELETE_LOCAL_RC_RESEARCH' });
          statusRevision.current++; setStatuses({}); setRecords([]); setSelected(null); setCollection({}); setGroups(null);
          setOffset(0); setFilter('all'); setSessionGroupId(null); setSessionForm(true); setGroupForm(false); setDirty(false); setNotes(false);
          await refresh(true);
        }) },
      ]);
    } : undefined} />
    <ResearchDialog visible={options} title="Session options" icon={Settings2} onClose={() => setOptions(false)}>
      <Pressable accessibilityRole="button" disabled={busy || Boolean(state?.checking)} className="min-h-control justify-center" onPress={remount}><Text className="font-sans text-body text-foreground">Phone remounted / moved</Text></Pressable>
      {collection.session_has_recordings && <Pressable accessibilityRole="button" disabled={busy || Boolean(state?.checking)} className="min-h-control justify-center border-t border-border" onPress={() => newSession()}><Text className="font-sans text-body text-foreground">Create new session</Text></Pressable>}
      <Text className="font-sans text-caption text-secondary-foreground">{onlineStatus ? 'Server status checked' : 'Server status unavailable; saved receipts may be cached.'}</Text>
    </ResearchDialog>
  </View>;
}
