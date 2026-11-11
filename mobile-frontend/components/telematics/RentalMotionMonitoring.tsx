import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, Text, View } from 'react-native';
import { Activity } from 'lucide-react-native';
import { ActionButton } from '@/components/bookings/ActionButton';
import { SectionCard } from '@/components/bookings/SectionCard';
import { stopRentalMotion as closeInterrupted, getRentalMotion, type RentalMotionState } from '@/services/api/rental-motion.service';
import { beginRentalDriveMonitoring, pauseRentalDriveMonitoring, recoverRentalDriveMonitoring, rentalMotionStatus, type RentalMotionStatus } from '@/services/telematics/rental-drive-monitoring';
export function RentalMotionMonitoring({ bookingCode, userId, status, starting, motionError, refreshStatus, gpsActive, onResumeCheck }: {
  bookingCode: string; userId: number; status: RentalMotionStatus | null; starting: boolean;
  motionError: string | null; refreshStatus: () => Promise<void>;
  gpsActive: boolean; onResumeCheck: (onResume: () => void) => void;
}) {
  const focused = useRef(false);
  const gpsActiveRef = useRef(gpsActive);
  gpsActiveRef.current = gpsActive;
  useFocusEffect(useCallback(() => { focused.current = true; return () => { focused.current = false; }; }, []));
  const [server, setServer] = useState<RentalMotionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!focused.current || AppState.currentState !== 'active') return;
    const remote = await getRentalMotion(bookingCode);
    if (!focused.current) return;
    setServer(remote);
  }, [bookingCode]);
  useEffect(() => {
    let current = true;
    const update = () => { if (current) void refresh().catch(() => undefined); };
    update(); const timer = setInterval(update, 2000);
    return () => { current = false; clearInterval(timer); };
  }, [refresh]);
  const perform = async (action: () => Promise<void>) => {
    setBusy(true); setMessage(null);
    try { await action(); await Promise.allSettled([refresh(), refreshStatus()]); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Motion monitoring could not be updated.'); }
    finally { setBusy(false); }
  };
  const active = status?.active && status.booking_code === bookingCode;
  const pending = status?.unfinished.find(item => item.booking_code === bookingCode);
  const interruptedId = !active && !pending && status ? server?.active_session_id : null;
  const queued = active || pending ? status?.pending_batches ?? 0 : 0;
  const state = active ? 'Active' : starting ? 'Waiting for GPS' : pending ? 'Sync pending'
    : server?.available === false ? 'Unavailable' : status ? 'Paused' : 'Status unavailable';
  const issue = message ?? motionError ?? status?.error;
  const requestStart = () => {
    Alert.alert('Start motion monitoring?',
      'Confirm the phone has stayed in the same calibrated position. If it was removed or shifted, do not restart motion with the old reference.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Same position', onPress: () => onResumeCheck(() => {
          void perform(async () => {
            if (!gpsActiveRef.current) throw new Error('Start GPS monitoring before starting motion.');
            const current = await rentalMotionStatus(userId);
            if (!current || current.active || current.unfinished.some(item => item.booking_code === bookingCode)) {
              throw new Error('Check the motion status and finish any pending sync first.');
            }
            await beginRentalDriveMonitoring(userId, bookingCode, () => gpsActiveRef.current && focused.current && AppState.currentState === 'active');
          });
        }) },
      ]);
  };
  return <SectionCard title="Drive Monitoring" icon={Activity} density="compact"
    headerEnd={
      <View className="max-w-[45%] flex-row items-center gap-2">
        <View accessible={false} className={`size-2 rounded-full ${active ? 'bg-success' : starting || pending ? 'bg-primary' : 'bg-border'}`} />
        <Text accessibilityLiveRegion="polite" className="font-sans shrink text-right text-caption font-medium text-foreground">{state}</Text>
      </View>
    }>
    {queued > 0 ? <Text className="font-sans text-caption text-secondary-foreground">{queued} {queued === 1 ? 'batch' : 'batches'} to sync</Text> : null}
    {issue ? <Text accessibilityLiveRegion="polite" className="font-sans mt-2 text-caption text-secondary-foreground">{issue}</Text> : null}
    {active ? <Pressable
      accessibilityRole="button"
      accessibilityLabel="Stop motion monitoring"
      accessibilityHint="Stops motion readings while GPS sharing continues."
      accessibilityState={{ disabled: busy || starting }}
      disabled={busy || starting}
      onPress={() => void perform(async () => {
        const current = await rentalMotionStatus(userId);
        if (!current?.active || current.booking_code !== bookingCode) {
          throw new Error('Motion monitoring is no longer active for this rental.');
        }
        await pauseRentalDriveMonitoring();
      })}
      className="min-h-[44px] self-start justify-center disabled:opacity-50">
      <Text className="font-sans text-caption font-semibold text-primary underline">{busy ? 'Stopping motion…' : 'Stop motion'}</Text>
    </Pressable> : null}
    {!active && status && !pending && !interruptedId && server?.available !== false ? <Pressable
      accessibilityRole="button"
      accessibilityLabel="Start motion monitoring"
      accessibilityHint="Checks the phone before starting motion readings. GPS sharing continues."
      accessibilityState={{ disabled: busy || starting || !gpsActive }}
      disabled={busy || starting || !gpsActive}
      onPress={requestStart}
      className="min-h-[44px] self-start justify-center disabled:opacity-50">
      <Text className="font-sans text-caption font-semibold text-primary underline">{busy ? 'Starting motion…' : 'Start motion'}</Text>
    </Pressable> : null}
    {!active && !gpsActive && !pending && !interruptedId ? <Text className="font-sans text-caption text-secondary-foreground">Start GPS monitoring first.</Text> : null}
    {!active && (pending || interruptedId) ? <View className="mt-3">
      {pending ? <ActionButton label="Finish sync" disabled={busy || starting} onPress={() => void perform(() => recoverRentalDriveMonitoring(userId, bookingCode, pending.id))} />
        : interruptedId ? <ActionButton label="Close interrupted capture" disabled={busy || starting} onPress={() => void perform(async () => { await closeInterrupted(bookingCode, interruptedId); })} /> : null}
    </View> : null}
  </SectionCard>;
}
