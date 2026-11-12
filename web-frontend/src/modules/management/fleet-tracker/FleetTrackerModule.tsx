"use client";

import { RentalDrivingEvents } from "./components/RentalDrivingEvents";

import { useRef, useState } from "react";
import { Loader2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { SearchInput } from "@/components/common/forms/SearchInput";
import { TablePagination } from "@/components/common/tables/TablePagination";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ManagementPageHeading } from "@/modules/management/shell/components/ManagementPageHeading";
import { formatReturnDateTime } from "@/services/booking/return-time";
import type { FleetQuery } from "@/validations/fleet/schemas";
import { FleetVehicleCard } from "./components/FleetVehicleCard";
import { fleetVehicleName } from "./fleet-presentation";
import { fleetStatusLabels, fleetTrackingFilters } from "./fleet-status";
import { useFleetRentals } from "./useFleetRentals";
import { FleetGoogleMap } from "./components/google-maps/FleetGoogleMap";
import { FleetGeofenceLog } from "./components/FleetGeofenceLog";

export default function FleetTracker() {
  const {
    searchInput,
    setSearchInput,
    query,
    page,
    loading,
    error,
    connection,
    dataVersion,
    changeQuery,
    refresh,
  } = useFleetRentals();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedTrigger = useRef<HTMLElement | null>(null);
  const selected =
    !loading && !error
      ? page?.rentals.find((rental) => rental.id === selectedId)
      : null;
  const hasFilters = Boolean(searchInput || query.status || query.tracking_state || query.rental_type);

  return (
    <div className="min-h-screen space-y-5 bg-background p-4 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <ManagementPageHeading
          title="Fleet Monitoring"
          description="View ongoing rentals and their tracking status."
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => refresh()}
          disabled={loading}
        >
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
          Refresh
        </Button>
      </div>

      <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <Card className="order-2 gap-0 rounded-2xl border border-border bg-surface py-0 shadow-none lg:sticky lg:top-4 lg:order-1">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-4">
            <CardTitle className="text-sm font-semibold">Fleet map</CardTitle>
            <span role="status" className="text-xs text-muted-foreground">
              {error ? "Updates unavailable" : connection === "connected" ? "Updates connected" : connection === "connecting" ? "Connecting updates" : connection === "offline" ? "Updates reconnecting" : "Automatic updates every 30 seconds"}
            </span>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            {error ? (
              <div role="status" className="flex h-[360px] items-center justify-center rounded-xl border border-border bg-background p-6 text-center text-sm text-muted-foreground sm:h-[480px]">
                Locations unavailable
              </div>
            ) : (
              <FleetGoogleMap
                rentals={loading ? [] : page?.rentals ?? []}
                loadingRentals={loading}
                selectedId={selectedId}
                onSelect={(id, trigger) => {
                  selectedTrigger.current = trigger;
                  setSelectedId(id);
                }}
              />
            )}
            {page && page.lastPage > 1 ? <p className="mt-2 text-xs text-muted-foreground">Locations on page {page.page} of {page.lastPage}</p> : null}
          </CardContent>
        </Card>

        <Card className="order-1 min-w-0 gap-0 rounded-2xl border border-border bg-surface py-0 shadow-none lg:order-2">
          <CardHeader className="space-y-3 border-b border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold">
                Active rentals
              </CardTitle>
              <Badge
                variant="outline"
                className="border-border bg-muted text-primary"
              >
                {loading || error || !page ? "—" : page.totalOngoing} ongoing
              </Badge>
            </div>
            <SearchInput
              value={searchInput}
              onValueChange={setSearchInput}
              maxLength={160}
              placeholder="Booking, customer, vehicle, plate"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <FilterSelect
                prefixLabel="Tracking"
                value={query.tracking_state ?? "all"}
                ariaLabel="Filter rentals by tracking status"
                placeholder="All statuses"
                height="compact"
                className="min-w-0"
                options={fleetTrackingFilters}
                onValueChange={(value) =>
                  changeQuery({
                    status: undefined,
                    tracking_state: value === "all" ? undefined : (value as FleetQuery["tracking_state"]),
                    page: 1,
                  })
                }
              />
              <FilterSelect
                prefixLabel="Type"
                value={query.rental_type ?? "all"}
                ariaLabel="Filter rentals by type"
                placeholder="All rentals"
                height="compact"
                className="min-w-0"
                options={[
                  { value: "all", label: "All rentals" },
                  { value: "self_drive", label: "Self-Drive" },
                  { value: "owners_driver", label: "Assigned driver" },
                ]}
                onValueChange={(value) =>
                  changeQuery({
                    rental_type:
                      value === "all"
                        ? undefined
                        : (value as FleetQuery["rental_type"]),
                    page: 1,
                  })
                }
              />
            </div>
            {hasFilters ? (
              <Button
                variant="ghost"
                size="sm"
                className="justify-self-start"
                onClick={() => {
                  setSearchInput("");
                  changeQuery({
                    search: "",
                    status: undefined,
                    tracking_state: undefined,
                    rental_type: undefined,
                    page: 1,
                  });
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="p-4" aria-busy={loading}>
            {loading ? (
              <div
                role="status"
                className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"
              >
                <Loader2 className="size-4 animate-spin" />
                Loading active rentals
              </div>
            ) : error ? (
              <div className="space-y-3 rounded-xl border border-destructive-border bg-destructive-surface p-4">
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
                <Button variant="outline" size="sm" onClick={() => refresh()}>
                  Try again
                </Button>
              </div>
            ) : !page?.rentals.length ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {hasFilters
                  ? "No rentals match these filters."
                  : "No ongoing rentals."}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {page.rentals.map((rental) => (
                  <FleetVehicleCard
                    key={rental.id}
                    rental={rental}
                    isSelected={selectedId === rental.id}
                    onSelect={(id, trigger) => {
                      selectedTrigger.current = trigger;
                      setSelectedId(id);
                    }}
                  />
                ))}
              </div>
            )}
            {!loading && !error && page ? (
              <TablePagination
                total={page.total}
                page={page.page}
                lastPage={page.lastPage}
                label="Active rentals pagination"
                onPageChange={(next) => {
                  setSelectedId(null);
                  changeQuery({ page: next });
                }}
              />
            ) : null}
          </CardContent>
        </Card>
      </section>

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent
          aria-describedby={undefined}
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-2xl border-border bg-background"
          onCloseAutoFocus={(event) => {
            if (selectedTrigger.current?.isConnected) {
              event.preventDefault();
              selectedTrigger.current.focus();
            }
          }}
        >
          {selected ? (
            <>
              <SheetHeader className="border-b border-border px-6 py-4">
                <SheetTitle>
                  {fleetVehicleName(selected.vehicle)}
                </SheetTitle>
              </SheetHeader>
              <div className="grid items-start gap-6 p-4 sm:p-6 lg:grid-cols-2">
              <Card className="min-w-0 lg:col-span-2">
              <CardHeader className="min-h-14 border-b border-border pb-3"><CardTitle className="text-sm font-semibold">Booking information</CardTitle><CardDescription className="text-xs">{selected.bookingCode}</CardDescription></CardHeader>
              <CardContent>
              <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Plate", selected.vehicle?.plateNumber || "Unavailable"],
                  ["Customer", selected.customerName || "Unavailable"],
                  ["Operator", selected.operator?.name || "Unavailable"],
                  ["Contact", selected.operator?.phoneNumber || "Unavailable"],
                  ["Email", selected.operator?.email || "Unavailable"],
                  [
                    "Rental type",
                    selected.rentalType === "self_drive"
                      ? "Self-Drive"
                      : "Assigned driver",
                  ],
                  ["Tracking", fleetStatusLabels[selected.tracking.status]],
                  [
                    "Scheduled start",
                    formatReturnDateTime(selected.rentalStartAt),
                  ],
                  ["Return by", formatReturnDateTime(selected.rentalEndAt)],
                  [
                    "Last location update",
                    selected.tracking.lastLocationAt
                      ? formatReturnDateTime(
                          selected.tracking.lastLocationAt,
                          true,
                        )
                      : "No location received",
                  ],
                  ...(selected.tracking.location ? [
                    ["Last location", `${selected.tracking.location.latitude.toFixed(6)}, ${selected.tracking.location.longitude.toFixed(6)}`],
                    ["GPS accuracy", `±${Math.round(selected.tracking.location.accuracy)} m`],
                  ] : [["Last location", "Unavailable"]]),
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 space-y-1">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="break-words font-medium text-foreground">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 border-t border-border pt-4 text-sm">
                <p className="font-semibold">Customer emergency contacts</p>
                {selected.emergencyContacts.length ? selected.emergencyContacts.map((contact, index) => <p key={index} className="mt-1 text-muted-foreground">{contact.name} · {contact.relationship} · {contact.phoneNumber}</p>) : <p className="mt-1 text-muted-foreground">No emergency contact provided</p>}
              </div>
              </CardContent></Card>
              <RentalDrivingEvents key={selected.bookingCode} bookingCode={selected.bookingCode} dataVersion={dataVersion} />
              <FleetGeofenceLog activity={selected.geofenceActivity} onRefresh={() => refresh(true)} />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
