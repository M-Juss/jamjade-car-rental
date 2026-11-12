import { ApiError, apiGet, apiPost } from '@/services/http';
import type { DriveReference } from './drive-monitoring.service';
import { rentalMotionConsentSchema, stopRentalMotionSchema, type RentalMotionConsent } from '@/validation/telematics/rental-motion';
export type RentalMotionState = { available: boolean; sensor_platform: 'rc'; active_session_id: string | null; report_sync_closed?: boolean };
export type RentalMotionSession = { id: string; telematics_trip_id: number; sensor_platform: 'rc'; status: 'active' | 'stopped'; runtime_reference: DriveReference };
const path = (booking: string) => `/mobile/bookings/${encodeURIComponent(booking)}/motion-monitoring`;
export async function getRentalMotion(booking: string): Promise<RentalMotionState> {
  return (await apiGet<RentalMotionState>(path(booking))).data;
}
export async function startRentalMotion(booking: string, input: RentalMotionConsent): Promise<RentalMotionSession> {
  try {
    return (await apiPost<RentalMotionSession>(`${path(booking)}/start`, rentalMotionConsentSchema.parse(input))).data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) {
      const message = error.errors?.monitoring?.[0] ?? error.errors?.consent_version?.[0] ?? error.errors?.same_mount_confirmed?.[0];
      if (message) throw new ApiError(message, error.status, error.errors);
    }
    throw error;
  }
}
export async function stopRentalMotion(booking: string, id: string): Promise<Omit<RentalMotionSession, 'runtime_reference'>> {
  const payload = stopRentalMotionSchema.parse({ reason: 'interrupted' });
  return (await apiPost<Omit<RentalMotionSession, 'runtime_reference'>>(`${path(booking)}/sessions/${encodeURIComponent(id)}/stop`, payload)).data;
}
