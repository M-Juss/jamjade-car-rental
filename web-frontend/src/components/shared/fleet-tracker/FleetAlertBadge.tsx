import { AlertType } from "@/lib/mock_fleet_tracker";
import { Badge } from "@/components/ui/badge";

const alertClass: Record<AlertType, string> = {
  None: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Geofence: "bg-rose-50 text-rose-600 border-rose-200",
  "Driving Incident": "bg-amber-50 text-amber-700 border-amber-200",
  GPS: "bg-violet-50 text-violet-700 border-violet-200",
  Overspeed: "bg-orange-50 text-orange-700 border-orange-200",
};

export function FleetAlertBadge({ alertType }: { alertType: AlertType }) {
  return (
    <Badge className={`w-full max-w-full justify-center truncate border rounded-full px-2 py-1 text-[10.5px] font-semibold ${alertClass[alertType]}`}>
      {alertType === "None" ? "No Alert" : alertType}
    </Badge>
  );
}
