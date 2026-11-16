import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { Activity } from 'lucide-react-native';
import { ActionButton } from '@/components/bookings/ActionButton';
import { SectionCard } from '@/components/bookings/SectionCard';
import { stopRentalMotion as closeInterrupted, getRentalMotion, type RentalMotionState } from '@/services/api/rental-motion.service';
import { recoverRentalDriveMonitoring, type RentalMotionStatus } from '@/services/telematics/rental-drive-monitoring';
export function RentalMotionMonitoring({ bookingCode, userId, status, starting, motionError, refreshStatus, ended = false }: {
  bookingCode: string; userId: number; status: RentalMotionStatus | null; starting: boolean;
  motionError: string | null; refreshStatus: () => Promise<void>;
  ended?: boolean;
}) {
  const focused = useRef(false);
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
  const syncClosed = server?.report_sync_closed === true;
  const queued = active || pending ? status?.pending_batches ?? 0 : 0;
  const state = syncClosed ? 'Sync closed' : active ? 'Active' : starting ? 'Starting' : pending ? 'Sync pending'
    : server?.available === false ? 'Unavailable' : status ? 'Paused' : 'Status unavailable';
  const issue = message ?? motionError ?? status?.error;
  if (ended && !active && !pending && !interruptedId) return null;

  return <SectionCard title="Drive Monitoring" icon={Activity} density="compact"
    headerEnd={
      <View className="max-w-[45%] flex-row items-center gap-2">
        <View accessible={false} className={`size-2 rounded-full ${active ? 'bg-success' : starting || pending ? 'bg-primary' : 'bg-border'}`} />
        <Text accessibilityLiveRegion="polite" className="font-sans shrink text-right text-caption font-medium text-foreground">{state}</Text>
      </View>
    }>
    {syncClosed ? <Text className="font-sans text-caption text-secondary-foreground">The driving report upload window has closed.</Text> : null}
    {!syncClosed && queued > 0 ? <Text className="font-sans text-caption text-secondary-foreground">{queued} {queued === 1 ? 'batch' : 'batches'} to sync</Text> : null}
    {!syncClosed && issue ? <Text accessibilityLiveRegion="polite" className="font-sans mt-2 text-caption text-secondary-foreground">{issue}</Text> : null}
    {!syncClosed && !active && (pending || interruptedId) ? <View className="mt-3">
      {pending ? <ActionButton label="Finish sync" disabled={busy || starting} onPress={() => void perform(() => recoverRentalDriveMonitoring(userId, bookingCode, pending.id))} />
        : interruptedId ? <ActionButton label="Close interrupted capture" disabled={busy || starting} onPress={() => void perform(async () => { await closeInterrupted(bookingCode, interruptedId); })} /> : null}
    </View> : null}
  </SectionCard>;
}
