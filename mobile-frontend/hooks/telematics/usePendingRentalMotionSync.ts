import { useEffect } from 'react';
import { AppState } from 'react-native';
import { getNetworkReadiness } from '@/services/telematics/network-readiness';
import { discardCompletedRentalMotion, recoverRentalDriveMonitoring, rentalMotionStatus } from '@/services/telematics/rental-drive-monitoring';

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
        if (!eligible() || !status) return;
        for (const pending of status.unfinished) {
          if (!eligible()) return;
          try {
            if (await discardCompletedRentalMotion(userId, pending.booking_code, pending.id, eligible)) continue;
            if (!status.active && status.state === 'stopped') {
              await recoverRentalDriveMonitoring(userId, pending.booking_code, pending.id, eligible);
              return;
            }
          } catch { /* A failed server check must preserve this session. */ }
        }
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
