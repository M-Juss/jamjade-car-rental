import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { FleetRental } from "@/services/fleet/types";
import { formatReturnDateTime } from "@/services/booking/return-time";
import { fleetStatusLabels } from "../fleet-status";
import { fleetVehicleName } from "../fleet-presentation";

export function FleetVehicleCard({ rental, isSelected, onSelect }: {
  rental: FleetRental;
  isSelected: boolean;
  onSelect: (id: number, trigger: HTMLButtonElement) => void;
}) {
  const { driving, trip, unreadNotifications } = rental.activityCounts;
  const activityTotal = driving + trip + unreadNotifications;
  const activityLabel = `${driving} driving events, ${trip} trip updates, ${unreadNotifications} unread notifications`;

  return (
    <button
      type="button"
      onClick={(event) => onSelect(rental.id, event.currentTarget)}
      aria-haspopup="dialog"
      aria-expanded={isSelected}
      aria-label={`View ${fleetVehicleName(rental.vehicle)}, ${rental.bookingCode}${activityTotal ? `, ${activityLabel}` : ""}`}
      className={`block w-full min-w-0 rounded-lg border-l-2 p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${isSelected ? "border-primary bg-muted" : "border-transparent hover:bg-background"}`}
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-sm font-semibold text-foreground">{fleetVehicleName(rental.vehicle)}</span>
        <span className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground">{rental.bookingCode}</span>
          {activityTotal > 0 && (
            <Badge variant="outline" className="border-warning-border bg-warning-surface text-warning tabular-nums" title={activityLabel}>
              <Bell aria-hidden="true" />
              {activityTotal > 99 ? "99+" : activityTotal}
            </Badge>
          )}
        </span>
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">{rental.vehicle?.plateNumber || "Plate unavailable"}</span>
      <span className="mt-3 grid grid-cols-2 gap-4">
        <span className="min-w-0">
          <span className="block break-words text-sm font-medium text-foreground">{rental.operator?.name || (rental.rentalType === "self_drive" ? rental.customerName : null) || "Operator unavailable"}</span>
          <span className="mt-1 block break-words text-xs text-muted-foreground">{rental.operator?.email || "Email unavailable"}</span>
          <span className="mt-1 block break-words text-xs text-muted-foreground">{rental.operator?.phoneNumber || "Contact unavailable"}</span>
        </span>
        <span className="grid min-w-0 gap-2 text-xs">
          <span><span className="block text-muted-foreground">Rental date</span><span className="mt-0.5 block font-medium text-foreground">{formatReturnDateTime(rental.rentalStartAt)}</span></span>
          <span><span className="block text-muted-foreground">Return date</span><span className="mt-0.5 block font-medium text-foreground">{formatReturnDateTime(rental.rentalEndAt)}</span></span>
        </span>
      </span>
      <span className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{rental.rentalType === "self_drive" ? "Self-Drive" : "Assigned driver"}</span>
        <span className="font-medium text-foreground">{fleetStatusLabels[rental.tracking.status]}</span>
      </span>
    </button>
  );
}
