import { Badge } from "@/components/ui/badge";
import type { FleetTrackingStatus } from "@/services/fleet/types";
import { fleetStatusLabels } from "../fleet-status";

const statusClass: Record<(typeof fleetStatusLabels)[FleetTrackingStatus], string> = {
  Active: "bg-success-surface text-success border-success-border",
  Paused: "bg-warning-surface text-warning border-warning-border",
  "Not Tracking": "bg-muted text-muted-foreground border-border",
};

export function FleetStatusBadge({ status }: { status: FleetTrackingStatus }) {
  const label = fleetStatusLabels[status];
  return (
    <Badge variant="outline" className={statusClass[label]}>
      {label}
    </Badge>
  );
}
