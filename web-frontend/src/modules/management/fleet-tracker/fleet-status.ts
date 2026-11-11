import type { FleetTrackingStatus } from "@/services/fleet/types";

export const fleetStatusLabels: Record<FleetTrackingStatus, string> = {
  not_started: "Not started",
  awaiting_location: "Awaiting location",
  recent_location: "Recent location",
  no_recent_updates: "No recent updates",
  paused: "Paused",
  ended: "Ended",
  unavailable: "Unavailable",
};

export const fleetTrackingFilters = [
  { value: "all", label: "All statuses" },
  { value: "updating", label: "Updating" },
  { value: "paused", label: "Paused" },
  { value: "no_updates", label: "No recent updates" },
  { value: "not_tracking", label: "Not tracking" },
] as const;
