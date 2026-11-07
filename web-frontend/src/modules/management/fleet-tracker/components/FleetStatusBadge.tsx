import { Badge } from "@/components/ui/badge";
import { VehicleStatus } from "@/modules/management/fleet-tracker/data/mock-fleet-tracker";

const statusClass: Record<VehicleStatus, string> = {
  Active: "bg-success-surface text-success border-success-border",
  Paused: "bg-warning-surface text-warning border-warning-border",
  Idle: "bg-background text-foreground border-border",
  "Geofence Alert": "bg-destructive-surface text-destructive border-destructive-border",
  "GPS Lost": "bg-violet-50 text-violet-700 border-violet-200",
};

export function FleetStatusBadge({ status }: { status: VehicleStatus }) {
  return (
    <Badge className={`w-full max-w-full justify-center truncate border rounded-full px-2 py-1 text-xs font-semibold ${statusClass[status]}`}>
      {status}
    </Badge>
  );
}
