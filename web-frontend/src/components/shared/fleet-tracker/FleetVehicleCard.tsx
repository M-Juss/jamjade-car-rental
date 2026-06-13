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
      className={`cursor-pointer rounded-xl border shadow-none transition-all hover:border-[#346EF6]/40 hover:bg-[#EEF4FF]/40 ${
        isSelected ? "border-[#346EF6]/40 bg-[#EEF4FF]/60" : "border-slate-100 bg-white"
      }`}
    >
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start gap-2">
          <Avatar className="h-9 w-9 shrink-0 rounded-lg bg-[#EEF4FF]">
            <AvatarFallback className="rounded-lg bg-[#EEF4FF] text-[#346EF6]">
              <CarFront className="size-4" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-[#1A2340]">{vehicle.carName}</p>
            <p className="truncate text-[11px] text-[#8896A7]">{vehicle.bookingId}</p>
          </div>
        </div>

        <div className="space-y-1 text-[11px] text-[#4A5568]">
          <p className="truncate">Customer: <span className="font-medium text-[#1A2340]">{vehicle.customerName}</span></p>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1"><Gauge className="size-3 text-[#346EF6]" />{vehicle.speedKph} kph</span>
            <span className="truncate text-[#8896A7]">{vehicle.lastUpdate}</span>
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
