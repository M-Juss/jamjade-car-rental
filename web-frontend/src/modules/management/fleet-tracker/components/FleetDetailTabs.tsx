import { Battery, CarFront, Gauge, MapPinned, Phone, Signal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FleetVehicle } from "@/modules/management/fleet-tracker/data/mock-fleet-tracker";
import { DrivingLogTimeline } from "./DrivingLogTimeline";

type FleetDetailTabsProps = {
  vehicle: FleetVehicle;
};

export function FleetDetailTabs({ vehicle }: FleetDetailTabsProps) {
  return (
    <Tabs defaultValue="overview" className="flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden">
      <TabsList className="h-auto w-full shrink-0 justify-start overflow-x-auto rounded-xl border border-border bg-surface/60 p-1">
        <TabsTrigger value="overview" className="text-sm">Overview</TabsTrigger>
        <TabsTrigger value="logs" className="text-sm">Driving Logs</TabsTrigger>
        <TabsTrigger value="geofence" className="text-sm">Geofencing</TabsTrigger>
        <TabsTrigger value="behavior" className="text-sm">Driver Behavior</TabsTrigger>
      </TabsList>

      <ScrollArea className="min-h-0 flex-1 overflow-hidden">
        <div className="px-2 pb-8">
          <TabsContent value="overview" className="m-1 space-y-2">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InfoCard label="Booking" value={`${vehicle.bookingId} (${vehicle.tripStatus})`} />
              <InfoCard label="Rental Duration" value={`${vehicle.rentalStart} to ${vehicle.rentalEnd}`} />
              <InfoCard label="Customer" value={vehicle.customerName} icon={<Phone className="size-3" />} subValue={vehicle.customerPhone} />
              <InfoCard label="Vehicle" value={vehicle.carName} icon={<CarFront className="size-3" />} />
              <InfoCard label="Coordinates" value={`${vehicle.lat.toFixed(4)}, ${vehicle.lng.toFixed(4)}`} icon={<MapPinned className="size-3" />} />
              <InfoCard label="Speed" value={`${vehicle.speedKph} kph`} icon={<Gauge className="size-3" />} />
              <InfoCard label="Battery" value={`${vehicle.batteryPercent}%`} icon={<Battery className="size-3" />} />
              <InfoCard label="GPS Signal" value={`${vehicle.gpsSignalPercent}%`} icon={<Signal className="size-3" />} />
            </div>
          </TabsContent>

          <TabsContent value="logs" className="m-1">
            <DrivingLogTimeline logs={vehicle.drivingLogs} />
          </TabsContent>

          <TabsContent value="geofence" className="m-1">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <InfoCard label="Allowed Zone" value={vehicle.allowedZone} />
              <InfoCard label="Current Zone" value={vehicle.currentZone} />
              <InfoCard label="Zone State" value={vehicle.geofenceState} />
              <InfoCard label="Distance from Boundary" value={`${vehicle.distanceFromBoundaryKm.toFixed(1)} km`} />
            </div>
          </TabsContent>

          <TabsContent value="behavior" className="m-1">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Harsh Braking" value={vehicle.behavior.harshBraking.toString()} />
                <MetricCard label="Sudden Acceleration" value={vehicle.behavior.suddenAcceleration.toString()} />
                <MetricCard label="Sharp Turns" value={vehicle.behavior.sharpTurns.toString()} />
                <MetricCard label="Idle Time" value={`${vehicle.behavior.idleMinutes} mins`} />
              </div>
            </div>
          </TabsContent>
        </div>
      </ScrollArea>
    </Tabs>
  );
}

function InfoCard({
  label,
  value,
  subValue,
  icon,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="rounded-xl border-border bg-slate-50/70 shadow-none">
      <CardContent className="min-h-20 p-4">
        <p className="text-xs font-medium leading-none text-muted-foreground">{label}</p>
        <div className="mt-1 flex min-w-0 items-center gap-1">
          {icon ? <span className="text-primary">{icon}</span> : null}
          <p className="truncate text-sm font-semibold leading-tight text-foreground" title={value}>{value}</p>
        </div>
        {subValue ? <p className="mt-0.5 truncate text-xs leading-none text-muted-foreground" title={subValue}>{subValue}</p> : null}
      </CardContent>
    </Card>
  );
}

function MetricCard({ label, value, highlighted = false }: { label: string; value: string; highlighted?: boolean }) {
  return (
    <Card className={`rounded-xl border-border shadow-none ${highlighted ? "bg-muted" : "bg-slate-50/70"}`}>
      <CardContent className="p-4">
        <p className="truncate text-xs font-medium leading-none text-muted-foreground">{label}</p>
        <p className={`mt-1 text-sm font-semibold leading-none ${highlighted ? "text-primary" : "text-foreground"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
