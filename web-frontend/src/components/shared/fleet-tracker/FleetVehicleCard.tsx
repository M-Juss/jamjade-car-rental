import { CarFront, Gauge } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { FleetVehicle } from "@/lib/mock_fleet_tracker";
import { FleetStatusBadge } from "./FleetStatusBadge";
import { FleetAlertBadge } from "./FleetAlertBadge";

type FleetVehicleCardProps = {
  vehicle: FleetVehicle;
  isSelected: boolean;
  onSelect: (id: string) => void;
};

export function FleetVehicleCard({ vehicle, isSelected, onSelect }: FleetVehicleCardProps) {
  return (
    <Card
      onClick={() => onSelect(vehicle.id)}
      className={`cursor-pointer rounded-xl border shadow-none transition-all hover:border-primary/40 hover:bg-muted/40 ${
        isSelected ? "border-primary/40 bg-muted/60" : "border-slate-100 bg-white"
      }`}
    >
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start gap-2">
          <Avatar className="h-9 w-9 shrink-0 rounded-lg bg-muted">
            <AvatarFallback className="rounded-lg bg-muted text-primary">
              <CarFront className="size-4" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-foreground">{vehicle.carName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{vehicle.bookingId}</p>
          </div>
        </div>

        <div className="space-y-1 text-[11px] text-muted-foreground">
          <p className="truncate">Customer: <span className="font-medium text-foreground">{vehicle.customerName}</span></p>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1"><Gauge className="size-3 text-primary" />{vehicle.speedKph} kph</span>
            <span className="truncate text-muted-foreground">{vehicle.lastUpdate}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div className="min-w-0">
            <FleetStatusBadge status={vehicle.status} />
          </div>
          <div className="min-w-0">
            <FleetAlertBadge alertType={vehicle.alertType} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
