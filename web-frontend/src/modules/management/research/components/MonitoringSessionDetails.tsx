"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetadataList } from "@/components/common/data-display/MetadataList";
import { SummaryList } from "@/components/common/data-display/SummaryList";
import { TablePagination } from "@/components/common/tables/TablePagination";
import type { MonitoringSessionDetail } from "@/services/research/drive-monitoring.service";
import { formatReturnDateTime } from "@/services/booking/return-time";
import { humanize, seconds } from "../recording-analysis";
import { MonitoringPredictions } from "./MonitoringPredictions";

export function MonitoringSessionDetails({ data }: { data: MonitoringSessionDetail }) {
  const [page, setPage] = useState(1);
  const lastPage = Math.max(1, Math.ceil(data.events.length / 10));
  const currentPage = Math.min(page, lastPage);
  const visibleEvents = data.events.slice((currentPage - 1) * 10, currentPage * 10);
  return <>
    <Card><CardContent><MetadataList className="text-sm sm:grid-cols-3" items={[
      { label: "Session status", value: data.session.status === "active" ? "Open" : "Stopped" },
      { label: "Collection session", value: data.session.research_session_number ? `S${String(data.session.research_session_number).padStart(2, "0")}` : "—" },
      { label: "Analyzed through", value: data.session.analyzed_through_ms ? seconds(data.session.analyzed_through_ms) : "No readings" },
      { label: "Batches received", value: data.received_batches.toLocaleString() },
      { label: "Last received", value: data.latest_received_at ? formatReturnDateTime(data.latest_received_at) : "No readings received" },
      { label: "Ended", value: data.session.ended_at ? formatReturnDateTime(data.session.ended_at) : "—" },
    ]} /></CardContent></Card>
    <Card>
      <CardHeader><CardTitle>Driving events</CardTitle></CardHeader>
      <CardContent>
        <SummaryList label="Driving event totals" items={[
          { label: "detected", value: data.event_summary.detected },
          { label: "uncertain", value: data.event_summary.needs_review },
          ...(data.event_summary.pending ? [{ label: "pending", value: data.event_summary.pending }] : []),
        ]} />
        {!data.events.length ? <p className="mt-4 text-sm text-muted-foreground">{!data.received_batches ? data.session.status === "active" ? "Waiting for readings before evaluating events." : "No readings were received for this session." : data.event_summary.pending ? "Event checks are pending." : "No harsh events detected in the received readings."}</p>
          : <div className="mt-3 divide-y divide-border">{visibleEvents.map(event => <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <div><p className="font-medium">{humanize(event.target)}</p><p className="mt-0.5 tabular-nums text-muted-foreground">{seconds(event.start_ms)}–{seconds(event.end_ms)}</p></div>
            <Badge variant={event.status === "review_required" ? "outline" : "destructive"} className={event.status === "review_required" ? "border-warning-border bg-warning-surface text-warning" : undefined}>{event.status === "review_required" ? "Uncertain" : "Detected"}</Badge>
          </div>)}</div>}
        {data.event_summary.detected + data.event_summary.needs_review > data.events.length && data.events.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Latest {data.events.length} events</p>}
        {lastPage > 1 && <TablePagination page={currentPage} lastPage={lastPage} total={data.events.length} onPageChange={setPage} label="Recent driving events pagination" />}
      </CardContent>
    </Card>
    <MonitoringPredictions batches={data.recent_predictions} />
  </>;
}
