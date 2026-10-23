import { CarFront } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import type { FleetRental } from "@/services/fleet/types";
import { formatReturnDateTime } from "@/services/booking/return-time";
import { fleetStatusLabels } from "../fleet-status";

export function FleetVehicleCard({ rental, isSelected, onSelect }: {
  rental: FleetRental;
  isSelected: boolean;
  onSelect: (id: number, trigger: HTMLButtonElement) => void;
}) {
  return (
    <button type="button" onClick={(event) => onSelect(rental.id, event.currentTarget)} aria-haspopup="dialog" aria-expanded={isSelected}
      aria-label={`View ${rental.vehicle?.name ?? "vehicle"}, ${rental.bookingCode}`}
      className="w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
      <Card className={`rounded-xl border py-0 shadow-none transition-colors hover:border-primary/40 hover:bg-muted/40 ${isSelected ? "border-primary/40 bg-muted/60" : "border-border bg-surface"}`}>
        <CardContent className="space-y-3 p-3">
          <div className="flex items-start gap-2">
            <Avatar className="h-9 w-9 shrink-0 rounded-lg bg-muted">
              <AvatarFallback className="rounded-lg bg-muted text-primary"><CarFront className="size-4" /></AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="break-words text-[13px] font-semibold leading-tight text-foreground">{rental.vehicle?.name ?? "Vehicle unavailable"}</p>
              <p className="mt-1 break-words text-[11px] text-muted-foreground">{rental.vehicle?.plateNumber || "Plate unavailable"} · {rental.bookingCode}</p>
            </div>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="break-words">{rental.customerName || "Customer unavailable"}</p>
            <p>Return: <span className="font-medium text-foreground">{formatReturnDateTime(rental.rentalEndAt)}</span></p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-xs">
            <span className="text-muted-foreground">{rental.rentalType === "self_drive" ? "Self-Drive" : "Assigned driver"}</span>
            <span className="font-medium text-foreground">{fleetStatusLabels[rental.tracking.status]}</span>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}
