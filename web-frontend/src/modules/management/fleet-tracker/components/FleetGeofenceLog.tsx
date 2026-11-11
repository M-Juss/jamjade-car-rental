"use client";

import { useState } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TablePagination } from "@/components/common/tables/TablePagination";
import { formatReturnDateTime } from "@/services/booking/return-time";
import type { FleetRental } from "@/services/fleet/types";

const PAGE_SIZE = 10;

export function FleetGeofenceLog({ activity, onRefresh }: {
  activity: FleetRental["geofenceActivity"];
  onRefresh: () => void;
}) {
  const [page, setPage] = useState(1);
  const lastPage = Math.max(1, Math.ceil(activity.length / PAGE_SIZE));
  const currentPage = Math.min(page, lastPage);
  const events = activity.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return <Card className="min-w-0">
    <CardHeader className="min-h-14 border-b border-border pb-3">
      <CardTitle className="text-sm font-semibold">Geofencing Log</CardTitle>
      <CardDescription className="text-xs">Latest zone crossings</CardDescription>
      <CardAction><Button variant="ghost" size="icon" aria-label="Refresh geofencing log" onClick={onRefresh}><RefreshCcw /></Button></CardAction>
    </CardHeader>
    <CardContent className="space-y-3">
      {events.length ? <div className="divide-y divide-border">
        {events.map((event) => <div key={event.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
          <div>
            <p className="font-medium">{event.type === "geofence_enter" ? "Entered" : "Exited"} {event.zoneName}</p>
            <p className="text-xs text-muted-foreground">{event.occurredAt ? `Occurred ${formatReturnDateTime(event.occurredAt, true)}` : "Event time unavailable"}</p>
          </div>
          {event.notificationRequested ? <span className="text-xs text-muted-foreground">Alert sent</span> : null}
        </div>)}
      </div> : <p className="text-sm text-muted-foreground">No geofence crossings recorded.</p>}
      {activity.length > PAGE_SIZE ? <TablePagination page={currentPage} lastPage={lastPage} total={activity.length} onPageChange={setPage} label="Geofencing log pagination" /> : null}
    </CardContent>
  </Card>;
}
