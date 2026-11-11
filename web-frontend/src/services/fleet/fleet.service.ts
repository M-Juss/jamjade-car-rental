import { TABLE_PAGE_SIZE } from "@/lib/table-pagination";
import { apiGet } from "@/services/http";
import { fleetQuerySchema, type FleetQuery } from "@/validations/fleet/schemas";

import type { FleetRental, FleetRentalsPage } from "./types";

export async function getFleetRentals(filters: FleetQuery, signal?: AbortSignal): Promise<FleetRentalsPage> {
  const values = fleetQuerySchema.parse({ ...filters, per_page: TABLE_PAGE_SIZE });
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const response = await apiGet<FleetRental[]>(`/admin/fleet-tracker?${query}`, { signal });
  return {
    rentals: response.data,
    page: Number(response.meta?.current_page ?? 1),
    lastPage: Number(response.meta?.last_page ?? 1),
    total: Number(response.meta?.total ?? 0),
    totalOngoing: Number(response.meta?.total_ongoing ?? 0),
  };
}

export type RentalDrivingGrade = {
  policy_version: string; maximum: number; deductions: number; confirmed_events: number; score: number | null;
  status: "provisional" | "not_graded";
  breakdown: Record<"harsh_acceleration" | "harsh_braking" | "harsh_cornering" | "harsh_swerve", { count: number; points_each: number; deduction: number }>;
};

export type RentalDrivingEvents = {
  operator: { id: number; name: string | null } | null;
  grading: RentalDrivingGrade;
  sensor_platform: "rc";
  session_status: "active" | "stopped" | null;
  sync_pending: boolean;
  coverage: {
    status: "unavailable" | "measured" | "no_readings";
    period_ms: number | null; analyzed_ms: number | null; uncovered_ms: number | null;
    percent: number | null; gap_count: number | null; period_ended: boolean;
  };
  maneuvers: Record<"harsh_acceleration" | "harsh_braking" | "harsh_cornering" | "harsh_swerve", number>;
  latest_received_at: string | null;
  event_summary: { detected: number; needs_review: number; pending: number };
  events: { id: string; target: string; status: "confirmed" | "review_required"; start_ms: number; end_ms: number; occurred_at: string | null; received_at: string }[];
};
export function getRentalDrivingEvents(booking: string, signal?: AbortSignal) {
  return apiGet<RentalDrivingEvents>(`/admin/fleet-tracker/${encodeURIComponent(booking)}/motion-monitoring`, { signal });
}
