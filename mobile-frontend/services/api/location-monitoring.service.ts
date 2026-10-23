import { apiGet, apiPost } from '@/services/http';
import {
  pauseLocationMonitoringSchema, startLocationMonitoringSchema, updateLatestLocationSchema,
  type LatestLocationFix, type LocationConsentInput, type LocationMonitoringPolicy,
} from '@/validation/telematics/location-monitoring';

export type LocationMonitoringSnapshot = {
  bookingCode: string;
  canMonitor: boolean;
  tripStatus: 'started' | 'paused' | 'ended' | null;
  lastLocationAt: string | null;
  policy: LocationMonitoringPolicy;
};
export type LocationMonitoringStart = LocationMonitoringSnapshot & { sessionToken: string };

const path = (code: string) => `/mobile/bookings/${encodeURIComponent(code)}/location-monitoring`;

export async function getLocationMonitoring(code: string, signal?: AbortSignal) {
  return (await apiGet<LocationMonitoringSnapshot>(path(code), { signal })).data;
}

export async function startLocationMonitoring(code: string, fix: LatestLocationFix, consent: LocationConsentInput, policy: LocationMonitoringPolicy, signal?: AbortSignal) {
  const payload = startLocationMonitoringSchema(policy).parse({ ...fix, ...consent });
  return (await apiPost<LocationMonitoringStart>(`${path(code)}/start`, payload, { signal })).data;
}

export async function updateLatestLocation(code: string, fix: LatestLocationFix, token: string, policy: LocationMonitoringPolicy, signal?: AbortSignal) {
  const payload = updateLatestLocationSchema(policy).parse({ ...fix, session_token: token });
  return (await apiPost<LocationMonitoringSnapshot>(`${path(code)}/location`, payload, { signal })).data;
}

export async function pauseLocationMonitoring(code: string, token: string, signal?: AbortSignal, reason?: 'manual' | 'interrupted') {
  return (await apiPost<LocationMonitoringSnapshot>(`${path(code)}/pause`, pauseLocationMonitoringSchema.parse({ session_token: token, ...(reason ? { reason } : {}) }), { signal })).data;
}
