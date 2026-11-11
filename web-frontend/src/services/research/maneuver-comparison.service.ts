import { apiGet } from "@/services/http";

export type Maneuver = "cornering" | "swerving" | "acceleration" | "braking";
export type Severity = "normal" | "harsh";
export type Measurement = "peak_turn_rate" | "peak_lateral_acceleration" | "peak_longitudinal_acceleration" | "duration";

export type ComparisonRecording = {
  id: string;
  name: string;
  surface: string;
  session_id: string | null;
  session_number: number | null;
  duration_ms: number;
  observation_revision_id: string | null;
  first_contact_ms: number | null;
  contact_status: "unflagged" | "review_needed" | "confirmed";
};

export type ReviewedManeuver = {
  recording_id: string;
  annotation_id: string;
  index: number;
  maneuver: Maneuver;
  severity: Severity;
  direction: "left" | "right" | "forward" | "reverse" | "unknown";
  start_ms: number;
  end_ms: number;
  measurements: Partial<Record<Measurement, number>> | null;
};

export type ManeuverComparison = { recordings: ComparisonRecording[]; events: ReviewedManeuver[] };
export type PreparedSample = [seconds: number, accelerationForward: number, accelerationRight: number, accelerationUp: number,
  rotationForward: number, rotationRight: number, rotationUp: number];

const path = "/admin/rc-research/model-explorer/maneuvers";

export function getManeuverComparison(signal: AbortSignal) {
  return apiGet<ManeuverComparison>(path, { signal, cache: "no-store" });
}

export function getManeuverSignal(event: ReviewedManeuver, signal: AbortSignal) {
  return apiGet<{ samples: PreparedSample[] }>(`${path}/${event.recording_id}/${event.annotation_id}/${event.index}`, { signal, cache: "no-store" });
}
