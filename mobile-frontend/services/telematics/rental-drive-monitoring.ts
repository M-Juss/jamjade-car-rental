import { ensureMotionNotificationPermission } from './native-recorder';
import nativeRecorder from '@/modules/rc-recorder';
import { startRentalMotion, stopRentalMotion } from '@/services/api/rental-motion.service';
import { getApiAuthToken } from '@/services/http/auth-token';
import { API_BASE_URL } from '@/services/http/config';
export type RentalMotionStatus = {
  active: boolean; booking_code: string | null; error: string | null; state: string;
  pending_batches: number; unfinished: { id: string; booking_code: string }[];
};
export async function rentalMotionStatus(owner: number): Promise<RentalMotionStatus | null> {
  if (!nativeRecorder?.rentalMonitoringStatus) return null;
  return JSON.parse(await nativeRecorder.rentalMonitoringStatus(String(owner))) as RentalMotionStatus;
}
async function transfer(owner: number, booking: string, session: string) {
  const token = await getApiAuthToken();
  if (!token) throw new Error('Sign in again to start monitoring.');
  const url = new URL(`${API_BASE_URL}/mobile/bookings/${encodeURIComponent(booking)}/motion-monitoring/sessions/${encodeURIComponent(session)}/batches`);
  if (url.protocol !== 'https:') throw new Error('Motion monitoring requires a secure backend connection.');
  return { owner_id: String(owner), booking_code: booking, session_id: session, api_url: url.toString(), token };
}
export async function beginRentalDriveMonitoring(owner: number, booking: string, isCurrent: () => boolean = () => true): Promise<void> {
  if (!nativeRecorder?.rentalMonitoringPrepare || !nativeRecorder.rentalMonitoringStart) throw new Error('Install the updated Android build to use rental motion monitoring.');
  await ensureMotionNotificationPermission('monitoring');
  if (!isCurrent()) throw new Error('Monitoring start was cancelled.');
  const clientId = await nativeRecorder.rentalMonitoringPrepare(String(owner), booking);
  if (!isCurrent()) throw new Error('Monitoring start was cancelled.');
  const session = await startRentalMotion(booking, { client_session_id: clientId,
    consent_version: 'rental-rc-motion-v1', consent: true, same_mount_confirmed: true });
  if (session.status !== 'active') {
    await nativeRecorder.rentalMonitoringDiscardStart?.();
    throw new Error('The previous start was closed. Resume monitoring to try again.');
  }
  try {
    if (!isCurrent()) throw new Error('Monitoring start was cancelled.');
    const destination = await transfer(owner, booking, session.id);
    if (!isCurrent()) throw new Error('Monitoring start was cancelled.');
    await nativeRecorder.rentalMonitoringStart(JSON.stringify({ ...destination, reference: session.runtime_reference }));
    for (let attempt = 0; attempt < 15; attempt++) {
      const status = await rentalMotionStatus(owner);
      if (!isCurrent()) throw new Error('Monitoring start was cancelled.');
      if (status?.active && status.booking_code === booking) return;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error('Motion capture could not start. Check notifications and retry.');
  } catch (error) {
    await nativeRecorder.rentalMonitoringStop?.();
    const pending = await rentalMotionStatus(owner).catch(() => null);
    if (pending && pending.pending_batches === 0) {
      try { await stopRentalMotion(booking, session.id); await nativeRecorder.rentalMonitoringDiscardStart?.(); } catch { /* Stable start identity permits recovery. */ }
    }
    throw error;
  }
}
export async function pauseRentalDriveMonitoring(): Promise<void> { await nativeRecorder?.rentalMonitoringStop?.(); }
export async function lockRentalDriveMonitoring(): Promise<void> { await nativeRecorder?.rentalMonitoringLock?.(); }
export async function recoverRentalDriveMonitoring(owner: number, booking: string, id: string): Promise<void> {
  if (!nativeRecorder?.rentalMonitoringRecover) throw new Error('Install the updated Android build first.');
  await nativeRecorder.rentalMonitoringRecover(JSON.stringify(await transfer(owner, booking, id)));
}
