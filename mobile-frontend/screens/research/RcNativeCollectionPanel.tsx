import { Activity, Database, Radio, RefreshCcw } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton, InfoRow, SectionCard } from '@/components/bookings';
import { KeyboardFormScrollView } from '@/components/common/KeyboardFormScrollView';
import { floatingTabBarContentPadding } from '@/constants/layout';
import { themeColors } from '@/constants/theme';
import { NativeRecordingForm } from '@/forms/research/NativeRecordingForm';
import { NATIVE_CHANNEL_LABELS, NATIVE_END_REASONS, type NativeRecorderState, type NativeRecording, type NativeCollectionGroup, type NativeGroupCatalog } from '@/lib/research/native-recorder';
import { formatRentalDate } from '@/lib/telematics/rental-card';
import { useAuth } from '@/providers/AuthProvider';
import { ApiError } from '@/services/http';
import { NativeRecorderError, nativeRecorder } from '@/services/telematics/native-recorder';
import type { NativeCollectionGroupInput, NativeRecordingInput } from '@/validation/research/native-recorder';

export function RcNativeCollectionPanel({ active, onRecordingChange }: { active: boolean; onRecordingChange: (recording: boolean) => void }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<NativeRecorderState | null>(null);
  const [records, setRecords] = useState<NativeRecording[]>([]);
  const [catalog, setCatalog] = useState<NativeGroupCatalog | null>(null);
  const [selected, setSelected] = useState<NativeRecording | null>(null);
  const [setup, setSetup] = useState(true);
  const [lastInput, setLastInput] = useState<NativeRecordingInput | undefined>();
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ id: string; sent: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true), working = useRef(false), querying = useRef<Promise<void> | null>(null), wasRecording = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { onRecordingChange(state?.active ?? false); }, [onRecordingChange, state?.active]);

  const refresh = useCallback(async (withList: boolean): Promise<void> => {
    if (!user || !nativeRecorder.available) return;
    if (querying.current) {
      if (withList) { await querying.current; return refresh(true); }
      return;
    }
    const query = (async () => {
      try {
        const next = await nativeRecorder.status();
        const ended = wasRecording.current && !next.active;
        wasRecording.current = next.active;
        if (mounted.current) { setState(next); if (withList) setError(null); if (next.active) setSetup(false); }
        if (withList || ended) {
          const [saved, groups] = await Promise.allSettled([nativeRecorder.list(offset), nativeRecorder.groups()]);
          if (mounted.current) {
            if (saved.status === 'fulfilled') setRecords(saved.value);
            if (groups.status === 'fulfilled') setCatalog(groups.value);
            else { setCatalog(null); setError('Collection groups cannot be read. Existing recordings remain listed below.'); }
          }
          if (saved.status === 'rejected') throw new Error('Local recording list is unavailable');
        }
      } catch { if (mounted.current) setError('Recorder access is unavailable. Connect and verify access again.'); }
      finally { if (mounted.current) setLoading(false); }
    })();
    querying.current = query;
    try { await query; } finally { querying.current = null; }
  }, [offset, user]);

  useEffect(() => {
    if (!active || !user || !nativeRecorder.available) { setLoading(false); return; }
    let current = true;
    const connect = async () => {
      try {
        if (!nativeRecorder.isAuthorized(user.id)) await nativeRecorder.authorize(user.id);
        if (current) { setError(null); await refresh(true); }
      } catch { if (current) { setLoading(false); setError('Connect to verify research access before using the recorder.'); } }
    };
    void connect();
    return () => { current = false; };
  }, [active, refresh, user]);

  useEffect(() => {
    if (!active || !nativeRecorder.available) return;
    const timer = setInterval(() => { if (AppState.currentState === 'active' && user && nativeRecorder.isAuthorized(user.id)) void refresh(false); }, 1000);
    return () => clearInterval(timer);
  }, [active, refresh, user]);

  const run = async (action: () => Promise<void>) => {
    if (working.current) return false;
    working.current = true; setBusy(true); setError(null);
    try { await action(); await refresh(true); return true; }
    catch (failure) {
      if (mounted.current) setError(failure instanceof ApiError && [401, 403].includes(failure.status)
        ? 'Research access expired. Sign in again.' : failure instanceof NativeRecorderError ? failure.message
          : 'Recorder action failed. Check access, sensor availability, notifications, and storage.');
      return false;
    } finally { working.current = false; if (mounted.current) setBusy(false); }
  };
  const start = async (values: NativeRecordingInput) => {
    if (!user) return;
    setSelected(null); setOffset(0); setLastInput(values); setSetup(false);
    if (!await run(() => nativeRecorder.start(user.id, values))) setSetup(true);
  };
  const retry = () => void run(async () => { if (user) await nativeRecorder.authorize(user.id); });
  const createGroup = async (values: NativeCollectionGroupInput) => {
    let created: NativeCollectionGroup | null = null;
    await run(async () => { created = await nativeRecorder.createGroup(values); });
    return created;
  };
  const current = selected ?? (setup && !state?.active ? null : state?.current);
  const upload = async (record: NativeRecording) => {
    if (!user) return;
    setUploadProgress({ id: record.recording_id, sent: 0, total: 0 });
    try {
      await run(() => nativeRecorder.upload(user.id, record.recording_id, (sent, total) => {
        if (mounted.current) setUploadProgress({ id: record.recording_id, sent, total });
      }));
    } finally { if (mounted.current) setUploadProgress(null); }
  };

  return <View className="flex-1">
    <View className="w-full max-w-[640px] flex-row items-center justify-between self-center px-screen pb-3"><Text accessibilityRole="header" className="font-sans text-section font-semibold text-foreground">Motion recording</Text><Pressable accessibilityRole="button" accessibilityLabel="Refresh local recordings" disabled={busy} className="min-h-control min-w-control items-center justify-center" onPress={() => void refresh(true)}><RefreshCcw size={20} color={themeColors.primary} /></Pressable></View>
    <KeyboardFormScrollView contentInsetAdjustmentBehavior="never" contentContainerClassName="w-full max-w-[640px] self-center px-screen pt-1" contentContainerStyle={{ paddingBottom: floatingTabBarContentPadding + insets.bottom }}>
      <View className="gap-4">
        {!nativeRecorder.available ? <SectionCard title="Android build required" icon={Activity}><Text className="font-sans text-body text-secondary-foreground">Install the updated Android development build. Expo Go and older builds do not include this recorder.</Text></SectionCard> : <>
          {loading ? <ActivityIndicator accessibilityLabel="Loading recorder" color={themeColors.primary} /> : null}
          {error ? <SectionCard title="Recorder unavailable" icon={Radio}><Text accessibilityRole="alert" className="font-sans mb-3 text-body text-destructive">{error}</Text><ActionButton label="Verify access" disabled={busy} onPress={retry} /></SectionCard> : null}
          {state?.error ? <Text accessibilityRole="alert" className="font-sans text-body text-destructive">{state.error}</Text> : null}
          {state?.active ? <SectionCard title={state.preparing ? 'Preparing sensors' : 'Recording on this phone'} icon={Activity}>
            <Text accessibilityLiveRegion="polite" className="font-sans mb-3 text-section font-semibold text-foreground">{((state.current?.duration_ms ?? 0) / 1000).toFixed(1)} s</Text>
            <ActionButton label={busy ? 'Stopping…' : 'Stop & save locally'} variant="primary" disabled={busy} onPress={() => void run(() => nativeRecorder.stop())} />
          </SectionCard> : setup ? catalog && <NativeRecordingForm disabled={busy || loading || Boolean(error)} catalog={catalog}
            onCreateGroup={createGroup} onStart={start} initialValues={lastInput} phonePower={state?.phone_power} /> : <ActionButton label="Record another trial" variant="primary" disabled={busy} onPress={() => { setSetup(true); setSelected(null); }} />}
          {current && <NativeRecordingDetails recording={current} />}
          <SectionCard title="Saved on this phone" icon={Database}>
            <Text className="font-sans mb-3 text-caption text-secondary-foreground">Original recordings stay on this phone after upload.</Text>
            {!nativeRecorder.uploadAvailable && <Text className="font-sans mb-3 text-caption text-secondary-foreground">Update the Android app to upload these recordings.</Text>}
            {!records.length ? <Text className="font-sans text-body text-secondary-foreground">No local recordings on this page.</Text> : <View className="gap-3">{records.map(record => <View key={record.recording_id} className="gap-2 border-b border-border pb-3">
              <Pressable accessibilityRole="button" accessibilityLabel={`Inspect ${record.context?.name ?? 'local recording'}`} onPress={() => void run(async () => { setSelected(await nativeRecorder.details(record.recording_id)); setSetup(false); })}>
                <Text className="font-sans text-body font-semibold text-primary">{record.context?.name ?? 'Unavailable recording'}</Text><Text className="font-sans mt-1 text-caption text-secondary-foreground">{record.started_at_utc ? formatRentalDate(record.started_at_utc) : 'Time unavailable'} · {record.state} · {((record.duration_ms ?? 0) / 1000).toFixed(1)} s</Text>
              </Pressable>
              <Text className="font-sans text-caption text-secondary-foreground">{record.transfer_state === 'uploaded' ? 'Uploaded and verified' : record.transfer_state === 'upload_failed' ? 'Upload failed · retry available' : 'Saved locally'} · Unlabeled</Text>
              {['stopped', 'interrupted'].includes(record.state) && nativeRecorder.uploadAvailable && <ActionButton
                label={uploadProgress?.id === record.recording_id ? `Uploading ${uploadProgress.sent}/${uploadProgress.total || '…'}` : record.transfer_state === 'uploaded' ? 'Verify uploaded copy' : record.transfer_state === 'local_only' ? 'Upload recording' : 'Retry upload'}
                disabled={busy || Boolean(state?.active)} onPress={() => Alert.alert('Upload recording?', 'Send motion readings, setup details and phone diagnostics to your private Admin research inspector. The local original will be kept.', [
                  { text: 'Cancel', style: 'cancel' }, { text: 'Upload', onPress: () => void upload(record) },
                ])} />}
              {record.state !== 'recording' && record.state !== 'preparing' && <ActionButton label="Delete local recording" variant="danger" disabled={busy} onPress={() => Alert.alert('Delete local recording?', 'This permanently removes the phone copy. Any complete or partial server upload is kept separately. Unuploaded data cannot be recovered.', [
                { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void run(async () => { await nativeRecorder.remove(record.recording_id); setSelected(null); }) },
              ])} />}
            </View>)}</View>}
            <View className="mt-3 flex-row gap-3"><ActionButton label="Previous" className="flex-1" disabled={offset === 0 || busy} onPress={() => setOffset(value => Math.max(0, value - 10))} /><ActionButton label="Next" className="flex-1" disabled={records.length < 10 || offset >= 90 || busy} onPress={() => setOffset(value => value + 10)} /></View>
          </SectionCard>
        </>}
      </View>
    </KeyboardFormScrollView>
  </View>;
}

function NativeRecordingDetails({ recording }: { recording: NativeRecording }) {
  const reason = recording.end_reason ? NATIVE_END_REASONS[recording.end_reason] ?? 'Recording ended' : null;
  return <SectionCard title={recording.context?.name ?? 'Recording details'} icon={Radio}>
    <InfoRow label="State" value={recording.state} /><InfoRow label={recording.diagnostics_partial ? 'Recovered span' : 'Duration'} value={`${((recording.duration_ms ?? 0) / 1000).toFixed(1)} s`} />
    {reason && <InfoRow label="Ended" value={reason} />}
    <InfoRow label="Storage" value="Encrypted on this phone" /><InfoRow label="Labels" value="Not assigned" />
    {recording.context?.recording_group_id && <>
      <InfoRow label="Collection group" value={recording.context.recording_group_name ?? 'Unknown'} />
      <InfoRow label="Group ID" value={recording.context.recording_group_id} />
      <InfoRow label="Recording number" value={String(recording.context.recording_number ?? 'Unknown')} />
    </>}
    {recording.device?.model && <InfoRow label="Phone" value={recording.device.model} />}
    {recording.phone_power && <>
      <InfoRow label="Battery at start" value={recording.phone_power.start.battery_percent == null ? 'Unavailable' : `${recording.phone_power.start.battery_percent.toFixed(0)}%`} />
      <InfoRow label={recording.phone_power.end ? 'Battery at end' : 'Current battery'} value={recording.phone_power.latest.battery_percent == null ? 'Unavailable' : `${recording.phone_power.latest.battery_percent.toFixed(0)}%`} />
      <InfoRow label="Charging" value={recording.phone_power.latest.charging == null ? 'Unavailable' : recording.phone_power.latest.charging ? 'Yes' : 'No'} />
      <InfoRow label="Battery Saver" value={recording.phone_power.latest.battery_saver == null ? 'Unavailable' : recording.phone_power.latest.battery_saver ? 'On' : 'Off'} />
    </>}
    {recording.diagnostics_partial && <Text className="font-sans my-2 text-caption text-warning">Recovered measurements have incomplete capture diagnostics. A missing tail is possible.</Text>}
    {Object.entries(recording.channels ?? {}).map(([name, channel]) => <View key={name} className="mt-3 border-t border-border pt-3">
      <Text className="font-sans text-body font-semibold text-foreground">{NATIVE_CHANNEL_LABELS[name] ?? name}</Text>
      <InfoRow label="Availability" value={channel.availability.replaceAll('_', ' ')} /><InfoRow label="Saved events" value={String(channel.statistics?.persisted_count ?? 0)} />
      <InfoRow label="Delivered rate" value={channel.statistics?.rate_hz == null ? 'Not enough data' : `${channel.statistics.rate_hz.toFixed(1)} Hz`} />
      <InfoRow label="Largest sensor gap" value={channel.statistics?.max_gap_ms == null ? 'Not enough data' : `${channel.statistics.max_gap_ms.toFixed(1)} ms`} />
      {Boolean(channel.statistics?.duplicate_timestamps || channel.statistics?.backwards_timestamps || channel.statistics?.rejected_count || channel.statistics?.not_durable_count) && <Text className="font-sans my-2 text-caption text-warning">
        {channel.statistics?.duplicate_timestamps ?? 0} repeated · {channel.statistics?.backwards_timestamps ?? 0} backward · {channel.statistics?.rejected_count ?? 'Unknown'} rejected · {channel.statistics?.not_durable_count ?? 'Unknown'} unsaved
      </Text>}
      <InfoRow label="Units" value={channel.unit === 'native_rotation_vector' ? 'Unitless; heading accuracy in rad' : channel.unit} />
    </View>)}
  </SectionCard>;
}
