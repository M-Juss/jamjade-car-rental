import { Badge } from "@/components/ui/badge";
import { VehicleStatus } from "@/modules/management/fleet-tracker/data/mock-fleet-tracker";

const statusClass: Record<VehicleStatus, string> = {
  Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Paused: "bg-amber-50 text-amber-700 border-amber-200",
  Idle: "bg-slate-100 text-slate-700 border-slate-200",
  "Geofence Alert": "bg-rose-50 text-rose-600 border-rose-200",
  "GPS Lost": "bg-violet-50 text-violet-700 border-violet-200",
};

export function FleetStatusBadge({ status }: { status: VehicleStatus }) {
  return (
    <Badge className={`w-full max-w-full justify-center truncate border rounded-full px-2 py-1 text-[10.5px] font-semibold ${statusClass[status]}`}>
      {status}
    </Badge>
  );
}
