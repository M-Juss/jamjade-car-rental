import type { FleetTrackingStatus } from "@/services/fleet/types";

export const fleetStatusLabels = {
  not_started: "Not Tracking",
  awaiting_location: "Not Tracking",
  recent_location: "Active",
  no_recent_updates: "Not Tracking",
  paused: "Paused",
  ended: "Not Tracking",
  unavailable: "Not Tracking",
} as const satisfies Record<FleetTrackingStatus, string>;

export const fleetTrackingFilters = [
  { value: "all", label: "All" },
  { value: "updating", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "not_tracking", label: "Not Tracking" },
] as const;
