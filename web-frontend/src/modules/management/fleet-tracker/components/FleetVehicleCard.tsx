import type { FleetRental } from "@/services/fleet/types";
import { formatReturnDateTime } from "@/services/booking/return-time";
import { fleetStatusLabels } from "../fleet-status";

export function FleetVehicleCard({ rental, isSelected, onSelect }: {
  rental: FleetRental;
  isSelected: boolean;
  onSelect: (id: number, trigger: HTMLButtonElement) => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => onSelect(rental.id, event.currentTarget)}
      aria-haspopup="dialog"
      aria-expanded={isSelected}
      aria-label={`View ${rental.vehicle?.name ?? "vehicle"}, ${rental.bookingCode}`}
      className={`block w-full min-w-0 rounded-lg border-l-2 p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${isSelected ? "border-primary bg-muted" : "border-transparent hover:bg-background"}`}
    >
      <span className="block text-sm font-semibold text-foreground">{rental.vehicle?.name ?? "Vehicle unavailable"}</span>
      <span className="mt-1 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{rental.vehicle?.plateNumber || "Plate unavailable"}</span><span>{rental.bookingCode}</span></span>
      <span className="mt-3 block text-sm text-muted-foreground">{rental.customerName || "Customer unavailable"}</span>
      <span className="mt-1 block text-xs text-muted-foreground">Return: <span className="font-medium text-foreground">{formatReturnDateTime(rental.rentalEndAt)}</span></span>
      <span className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{rental.rentalType === "self_drive" ? "Self-Drive" : "Assigned driver"}</span>
        <span className="font-medium text-foreground">{fleetStatusLabels[rental.tracking.status]}</span>
      </span>
    </button>
  );
}
