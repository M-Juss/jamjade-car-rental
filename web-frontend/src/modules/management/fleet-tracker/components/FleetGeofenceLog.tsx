"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SummaryList } from "@/components/common/data-display/SummaryList";
import { TablePagination } from "@/components/common/tables/TablePagination";
import { formatReturnDateTime } from "@/services/booking/return-time";
import type { FleetRental } from "@/services/fleet/types";
import { fleetStatusLabels } from "../fleet-status";
import { FleetActivityCard } from "./FleetActivityCard";

const PAGE_SIZE = 10;

export function FleetGeofenceLog({ activity, tracking, onRefresh }: {
  activity: FleetRental["geofenceActivity"];
  tracking: FleetRental["tracking"];
  onRefresh: () => void;
}) {
  const [page, setPage] = useState(1);
  const lastPage = Math.max(1, Math.ceil(activity.length / PAGE_SIZE));
  const currentPage = Math.min(page, lastPage);
  const events = activity.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const trackingDetails = [
    { label: "Tracking", value: fleetStatusLabels[tracking.status] },
    ...(tracking.location ? [
      { label: "Last location", value: `${tracking.location.latitude.toFixed(6)}, ${tracking.location.longitude.toFixed(6)}` },
      { label: "Accuracy", value: `±${Math.round(tracking.location.accuracy)} m` },
    ] : [{ label: "Last location", value: "Unavailable" }]),
  ];

  return (
    <FleetActivityCard
      title="Geofencing Log"
      description={tracking.lastLocationAt ? `Last location update ${formatReturnDateTime(tracking.lastLocationAt)}` : "No location received"}
      onRefresh={onRefresh}
    >
      <SummaryList items={trackingDetails} label="Tracking details" labelFirst className="gap-x-2.5" />
      {events.length ? <div className="divide-y divide-border">
        {events.map((event) => <div key={event.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
          <div className="min-w-0 break-words">
            <p className="font-medium">{event.type === "geofence_initial_inside" ? "Inside" : event.type === "geofence_enter" ? "Entered" : "Exited"} {event.zoneName}</p>
            <p className="text-xs text-muted-foreground">{event.occurredAt ? `Occurred ${formatReturnDateTime(event.occurredAt, true)}` : "Event time unavailable"}</p>
          </div>
          {event.notificationRequested ? <Badge variant="outline" className="text-muted-foreground">Alert sent</Badge> : null}
        </div>)}
      </div> : <p className="text-sm text-muted-foreground">No geofence activity recorded.</p>}
      {activity.length > PAGE_SIZE ? <TablePagination page={currentPage} lastPage={lastPage} total={activity.length} onPageChange={setPage} label="Geofencing log pagination" /> : null}
    </FleetActivityCard>
  );
}
