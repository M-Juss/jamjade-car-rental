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
