import { useEffect } from 'react';
import { AppState } from 'react-native';
import { getNetworkReadiness } from '@/services/telematics/network-readiness';
import { recoverRentalDriveMonitoring, rentalMotionStatus } from '@/services/telematics/rental-drive-monitoring';

/** Restart only an interrupted upload, never a motion capture. */
export function usePendingRentalMotionSync(userId: number | null) {
  useEffect(() => {
    if (!userId) return;
    let current = true;
    let running = false;
    const eligible = () => current && AppState.currentState === 'active';
    const retry = async () => {
      if (!eligible() || running) return;
      running = true;
      try {
        if (!await getNetworkReadiness() || !eligible()) return;
        const status = await rentalMotionStatus(userId);
        if (!eligible() || !status || status.active || status.state !== 'stopped') return;
        const pending = status.unfinished[0];
        if (pending) await recoverRentalDriveMonitoring(userId, pending.booking_code, pending.id, eligible);
      } catch {
        // Keep encrypted batches for the next retry or an explicit manual recovery.
      } finally { running = false; }
    };
    void retry();
    const timer = setInterval(() => void retry(), 10_000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void retry(); });
    return () => { current = false; clearInterval(timer); subscription.remove(); };
  }, [userId]);
}
