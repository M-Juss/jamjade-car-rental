"use client";

import { useMemo, useState } from "react";
import {
  CircleDot,
  Clock3,
  Loader2,
  RefreshCcw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { filterOptions, fleetVehicles, lastSyncedLabel } from "@/lib/mock_fleet_tracker";
import { FleetVehicleCard } from "./fleet-tracker/FleetVehicleCard";
import { FleetDetailTabs } from "./fleet-tracker/FleetDetailTabs";
import { FleetGoogleMap } from "./fleet-tracker/google-maps/FleetGoogleMap";

type FilterState = {
  status: string;
  geofence: string;
  alertType: string;
  vehicleType: string;
};

const initialFilters: FilterState = {
  status: "All",
  geofence: "All",
  alertType: "All",
  vehicleType: "All",
};

export default function FleetTracker() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [selectedVehicleId, setSelectedVehicleId] = useState(fleetVehicles[0]?.id ?? "");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showGeofence, setShowGeofence] = useState(true);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const filteredVehicles = useMemo(() => {
    return fleetVehicles.filter((vehicle) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = [
        vehicle.bookingId,
        vehicle.customerName,
        vehicle.plateNumber,
        vehicle.carName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);

      return (
        matchesSearch &&
        (filters.status === "All" || vehicle.status === filters.status) &&
        (filters.geofence === "All" || vehicle.geofenceState === filters.geofence) &&
        (filters.alertType === "All" || vehicle.alertType === filters.alertType) &&
        (filters.vehicleType === "All" || vehicle.vehicleType === filters.vehicleType)
      );
    });
  }, [filters, searchQuery]);

  const selectedVehicle = useMemo(() => {
    return fleetVehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? fleetVehicles[0] ?? null;
  }, [selectedVehicleId]);

  const alertCount = filteredVehicles.filter((vehicle) => vehicle.alertType !== "None").length;

  const onRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 900);
  };

  const handleVehicleSelect = (id: string) => {
    setSelectedVehicleId(id);
    setIsDetailsOpen(true);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F5F5F5] p-4 md:p-5 lg:p-6">
      <section className="shrink-0 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1A2340]">Fleet Tracker</h1>
            <p className="mt-0.5 text-sm text-[#8896A7]">Real-time monitoring of all active rentals</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#4A5568]">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
              <CircleDot className="size-3" />
              Live
            </span>
            <span className="inline-flex items-center gap-1"><Clock3 className="size-3" />Last synced: {lastSyncedLabel}</span>
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing}>
              {isRefreshing ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
              Refresh
            </Button>
          </div>
        </div>
      </section>

      <section className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[3fr_1fr]">
        <Card className="flex min-h-0 flex-col overflow-hidden rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <CardHeader className="shrink-0 px-4 pb-2 pt-4">
            <CardTitle className="text-sm font-bold text-[#1A2340]">Live Map</CardTitle>
            <CardDescription>Vehicle marker colors reflect real-time status.</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 pt-0">
            <FleetGoogleMap
              vehicles={filteredVehicles}
              selectedId={selectedVehicle?.id ?? ""}
              showGeofence={showGeofence}
              onSelect={handleVehicleSelect}
              onToggleGeofence={() => setShowGeofence((prev) => !prev)}
              className="min-h-0 flex-1"
            />
            <div className="shrink-0 flex flex-wrap gap-2 text-xs text-[#4A5568]">
              {[
                ["Active", "bg-emerald-500"],
                ["Paused", "bg-amber-500"],
                ["Idle", "bg-slate-500"],
                ["Geofence Alert", "bg-rose-500"],
                ["GPS Lost", "bg-violet-500"],
              ].map(([label, color]) => (
                <span key={label} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1">
                  <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                  {label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <CardHeader className="shrink-0 space-y-2 border-b border-slate-100 px-3 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="truncate text-sm font-bold text-[#1A2340]">Ongoing Booking</CardTitle>
                <p className="text-[11px] text-[#8896A7]">Active rentals now</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <SummaryPill label="Active" value={filteredVehicles.length} />
                <SummaryPill label="Alerts" value={alertCount} tone="warning" />
              </div>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#8896A7]" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Booking, customer, plate"
                className="h-8 rounded-lg border-slate-200 pl-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <FilterSelect
                label="Status"
                value={filters.status}
                options={filterOptions.status}
                placeholder="Status"
                onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
              />
              <FilterSelect
                label="Geofence"
                value={filters.geofence}
                options={filterOptions.geofence}
                placeholder="Zone"
                onValueChange={(value) => setFilters((prev) => ({ ...prev, geofence: value }))}
              />
              <FilterSelect
                label="Alert"
                value={filters.alertType}
                options={filterOptions.alertType}
                placeholder="Alert"
                onValueChange={(value) => setFilters((prev) => ({ ...prev, alertType: value }))}
              />
              <FilterSelect
                label="Type"
                value={filters.vehicleType}
                options={filterOptions.vehicleType}
                placeholder="Type"
                onValueChange={(value) => setFilters((prev) => ({ ...prev, vehicleType: value }))}
              />
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 px-3 pb-3 pt-3">
            {isRefreshing ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : (
              <ScrollArea className="h-full pr-3">
                <div className="space-y-2">
                  {/* Extract this into reusable component */}
                  {filteredVehicles.length ? filteredVehicles.map((vehicle) => (
                    <FleetVehicleCard
                      key={vehicle.id}
                      vehicle={vehicle}
                      isSelected={selectedVehicle?.id === vehicle.id}
                      onSelect={handleVehicleSelect}
                    />
                  )) : (
                    <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
                      <p className="text-xs font-medium text-[#1A2340]">No vehicles found</p>
                      <p className="mt-1 text-[11px] text-[#8896A7]">Try a different search or filter.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </section>

      <Sheet open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <SheetContent
          side="bottom"
          className="h-[70dvh] min-h-[70dvh] max-h-[70dvh] gap-0 overflow-hidden rounded-t-2xl border border-slate-200 bg-[#F5F5F5]"
        >
          {selectedVehicle ? (
            <>
              <SheetHeader className="shrink-0 border-b border-slate-200 px-6 py-4 md:px-8">
                <SheetTitle>{selectedVehicle.carName} - {selectedVehicle.plateNumber}</SheetTitle>
                <SheetDescription>Live details and driver behavior for this rental.</SheetDescription>
              </SheetHeader>
              <div className="mx-auto min-h-0 w-full max-w-[1500px] flex-1 overflow-hidden px-6 py-5 md:px-8">
                <FleetDetailTabs vehicle={selectedVehicle} />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  placeholder,
  onValueChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  placeholder: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-7 w-full min-w-0 rounded-lg border-slate-200 px-2 text-[11px]">
          <span className="mr-1 shrink-0 font-semibold text-[#8896A7]">{label}</span>
          <span className="min-w-0 flex-1 truncate text-left text-[#1A2340]">
            <SelectValue placeholder={placeholder} />
          </span>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SummaryPill({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "warning" }) {
  const toneClass = tone === "warning"
    ? "border-amber-200 bg-amber-50 text-amber-700"
    : "border-blue-200 bg-[#EEF4FF] text-[#346EF6]";

  return (
    <div className={`rounded-full border px-2 py-1 text-[10.5px] font-semibold leading-none ${toneClass}`}>
      {value} {label}
    </div>
  );
}
