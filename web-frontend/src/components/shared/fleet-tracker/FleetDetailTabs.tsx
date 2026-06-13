import { Battery, CarFront, Gauge, MapPinned, Phone, Signal, Video } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FleetVehicle } from "@/lib/mock_fleet_tracker";
import { DrivingLogTimeline } from "./DrivingLogTimeline";

type FleetDetailTabsProps = {
  vehicle: FleetVehicle;
};

export function FleetDetailTabs({ vehicle }: FleetDetailTabsProps) {
  return (
    <Tabs defaultValue="overview" className="flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden">
      <TabsList className="h-auto w-full shrink-0 justify-start overflow-x-auto rounded-xl border border-[#EEF1F8] bg-white/60 p-1">
        <TabsTrigger value="overview" className="text-[12px]">Overview</TabsTrigger>
        <TabsTrigger value="logs" className="text-[12px]">Driving Logs</TabsTrigger>
        <TabsTrigger value="geofence" className="text-[12px]">Geofencing</TabsTrigger>
        <TabsTrigger value="behavior" className="text-[12px]">Driver Behavior</TabsTrigger>
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

              <div className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#1A2340]">Retrieved Video Footage</p>
                    <p className="text-xs text-[#8896A7]">Latest camera clips linked to this active rental.</p>
                  </div>
                  <span className="rounded-full border border-[#DCE6FF] bg-[#EEF4FF] px-2.5 py-1 text-[10.5px] font-semibold text-[#346EF6]">
                    2 Clips
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {/* Extract this into reusable component */}
                  <VideoClipCard
                    title="Front Camera - Segment 01"
                    time="11:24 AM"
                    description="Clip duration: 00:45 - Event-linked telemetry snapshot captured."
                  />
                  <VideoClipCard
                    title="Cabin Camera - Segment 02"
                    time="11:27 AM"
                    description="Clip duration: 01:10 - Driver-behavior verification sequence."
                  />
                </div>
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
    <Card className="rounded-xl border-slate-200 bg-slate-50/70 shadow-none">
      <CardContent className="min-h-20 p-4">
        <p className="text-[10px] font-medium leading-none text-[#8896A7]">{label}</p>
        <div className="mt-1 flex min-w-0 items-center gap-1">
          {icon ? <span className="text-[#346EF6]">{icon}</span> : null}
          <p className="truncate text-[12px] font-semibold leading-tight text-[#1A2340]" title={value}>{value}</p>
        </div>
        {subValue ? <p className="mt-0.5 truncate text-[10px] leading-none text-[#8896A7]" title={subValue}>{subValue}</p> : null}
      </CardContent>
    </Card>
  );
}

function MetricCard({ label, value, highlighted = false }: { label: string; value: string; highlighted?: boolean }) {
  return (
    <Card className={`rounded-xl border-slate-200 shadow-none ${highlighted ? "bg-[#EEF4FF]" : "bg-slate-50/70"}`}>
      <CardContent className="p-4">
        <p className="truncate text-[10px] font-medium leading-none text-[#8896A7]">{label}</p>
        <p className={`mt-1 text-[13px] font-bold leading-none ${highlighted ? "text-[#346EF6]" : "text-[#1A2340]"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function VideoClipCard({ title, time, description }: { title: string; time: string; description: string }) {
  return (
    <Card className="rounded-xl border-slate-200 bg-slate-50/70 shadow-none">
      <CardContent className="p-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold text-[#1A2340]">
          <Video className="size-3.5 shrink-0 text-[#346EF6]" />
          <span className="truncate">{title}</span>
        </p>
        <span className="shrink-0 text-[11px] text-[#8896A7]">{time}</span>
      </div>
      <p className="mt-1 text-[11px] text-[#4A5568]">{description}</p>
      </CardContent>
    </Card>
  );
}
