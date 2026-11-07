import { AlertType } from "@/modules/management/fleet-tracker/data/mock-fleet-tracker";
import { Badge } from "@/components/ui/badge";

const alertClass: Record<AlertType, string> = {
  None: "bg-success-surface text-success border-success-border",
  Geofence: "bg-destructive-surface text-destructive border-destructive-border",
  "Driving Incident": "bg-warning-surface text-warning border-warning-border",
  GPS: "bg-violet-50 text-violet-700 border-violet-200",
  Overspeed: "bg-orange-50 text-orange-700 border-orange-200",
};

export function FleetAlertBadge({ alertType }: { alertType: AlertType }) {
  return (
    <Badge className={`w-full max-w-full justify-center truncate border rounded-full px-2 py-1 text-xs font-semibold ${alertClass[alertType]}`}>
      {alertType === "None" ? "No Alert" : alertType}
    </Badge>
  );
}
