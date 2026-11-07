import { LocateFixed, Minus, Plus, Radar, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FleetVehicle } from "@/modules/management/fleet-tracker/data/mock-fleet-tracker";

type FleetMapPlaceholderProps = {
  vehicles: FleetVehicle[];
  selectedId: string;
  showGeofence: boolean;
  onSelect: (id: string) => void;
  onToggleGeofence: () => void;
  className?: string;
};

const markerClasses: Record<FleetVehicle["status"], string> = {
  Active: "bg-emerald-500",
  Paused: "bg-amber-500",
  Idle: "bg-slate-500",
  "Geofence Alert": "bg-rose-500",
  "GPS Lost": "bg-violet-500",
};

export function FleetMapPlaceholder({
  vehicles,
  selectedId,
  showGeofence,
  onSelect,
  onToggleGeofence,
  className,
}: FleetMapPlaceholderProps) {
  return (
    <div className={`relative min-h-[320px] overflow-hidden rounded-2xl border border-border bg-background p-4 ${className ?? ""}`}>
      <div className="absolute inset-4 rounded-xl border border-dashed border-slate-300 bg-surface" />

      {showGeofence && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/40 bg-primary/10" />
      )}

      <div className="relative z-10 h-full w-full">
        {vehicles.map((vehicle, index) => {
          const top = 12 + ((index * 9) % 72);
          const left = 10 + ((index * 13) % 78);
          return (
            <button
              key={vehicle.id}
              type="button"
              onClick={() => onSelect(vehicle.id)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 ${selectedId === vehicle.id ? "z-20 scale-110" : "z-10"}`}
              style={{ top: `${top}%`, left: `${left}%` }}
              aria-label={`Select ${vehicle.carName}`}
            >
              <span className={`block h-4 w-4 rounded-full ring-4 ring-white shadow-none ${markerClasses[vehicle.status]}`} />
            </button>
          );
        })}
      </div>

      <div className="absolute left-7 top-7 z-20 rounded-xl border border-border bg-surface/90 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
        Map preview
      </div>

      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2">
        <Button variant="outline" size="icon-sm" aria-label="Zoom in"><Plus /></Button>
        <Button variant="outline" size="icon-sm" aria-label="Zoom out"><Minus /></Button>
        <Button variant="outline" size="icon-sm" aria-label="Center all vehicles"><LocateFixed /></Button>
        <Button variant={showGeofence ? "secondary" : "outline"} size="icon-sm" aria-label="Toggle geofence" onClick={onToggleGeofence}><Route /></Button>
        <Button variant="outline" size="icon-sm" aria-label="Traffic placeholder"><Radar /></Button>
      </div>
    </div>
  );
}
