"use client";
import { useEffect, useRef, useState } from "react";
import { RefreshCcw, Gauge, CircleStop, CornerUpRight, MoveHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SummaryList } from "@/components/common/data-display/SummaryList";
import { TablePagination } from "@/components/common/tables/TablePagination";
import { getRentalDrivingEvents, type RentalDrivingEvents as DrivingEvents } from "@/services/fleet/fleet.service";
import { getBookingDrivingAnalysis } from "@/services/booking";
import { formatReturnDateTime } from "@/services/booking/return-time";
import { KpiCard } from "@/components/common/data-display/KpiCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { ScoreCalculation } from "@/modules/management/driving-analysis/components/DrivingGradeDetails";
import type { BookingRecord } from "@/services/booking";

const ANALYSIS_LOG_PAGE_SIZE = 5;
type DrivingEventsSource = { bookingCode: string; dataVersion: number; analysisBookingId?: never }
  | { analysisBookingId: number; bookingCode?: never; dataVersion?: never; geofenceActivity?: BookingRecord["geofenceActivity"]; onAnalysisChange?: (analysis: DrivingEvents | null) => void };

export function RentalDrivingEvents({ bookingCode, dataVersion, analysisBookingId, ...source }: DrivingEventsSource) {
  const onAnalysisChange = "onAnalysisChange" in source ? source.onAnalysisChange : undefined;
  const requestRefresh = useRef<() => void>(() => {});
  const [data, setData] = useState<DrivingEvents | null>(null);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState(1);
  const [gpsPage, setGpsPage] = useState(1);
  useEffect(() => {
    let current = true;
    let request: AbortController | null = null;
    let blocked = false;
    const load = async () => {
      if (!current || blocked || request) return;
      const controller = new AbortController(); request = controller;
      try {
        const response = analysisBookingId !== undefined
          ? await getBookingDrivingAnalysis(analysisBookingId, controller.signal)
          : await getRentalDrivingEvents(bookingCode, controller.signal);
        if (current) { setData(response.data); setError(false); }
      } catch (failure) {
        if (current) { setData(null); setError(true); }
        if (failure && typeof failure === "object" && "status" in failure && [401, 403, 404].includes(Number(failure.status))) blocked = true;
      } finally { if (request === controller) request = null; }
    };
    requestRefresh.current = () => { void load(); };
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => { current = false; clearInterval(timer); request?.abort(); requestRefresh.current = () => {}; };
  }, [bookingCode, analysisBookingId, refresh]);
  useEffect(() => { requestRefresh.current(); }, [dataVersion]);
  useEffect(() => { onAnalysisChange?.(data); }, [data, onAnalysisChange]);
  const pageSize = analysisBookingId === undefined ? 10 : ANALYSIS_LOG_PAGE_SIZE;
  const lastPage = Math.max(1, Math.ceil((data?.events.length ?? 0) / pageSize));
  const currentPage = Math.min(page, lastPage);
  const emptyMessage = data?.latest_received_at
    ? data.event_summary.pending ? "Events are still being evaluated." : "No harsh events detected in received readings."
    : analysisBookingId === undefined ? "Start motion monitoring on the operator’s phone after release." : null;
  if (analysisBookingId !== undefined) {
    const activity = "geofenceActivity" in source ? source.geofenceActivity : undefined;
    const gpsLastPage = Math.max(1, Math.ceil((activity?.length ?? 0) / ANALYSIS_LOG_PAGE_SIZE));
    const currentGpsPage = Math.min(gpsPage, gpsLastPage);
    const categories = [
      { key: "harsh_acceleration", label: "Harsh acceleration", icon: Gauge },
      { key: "harsh_braking", label: "Harsh braking", icon: CircleStop },
      { key: "harsh_cornering", label: "Harsh cornering", icon: CornerUpRight },
      { key: "harsh_swerve", label: "Harsh swerving", icon: MoveHorizontal },
    ] as const;
    return <div className="space-y-5">
      {error ? <p role="alert" className="text-sm text-destructive">Driving analysis unavailable. <Button variant="link" onClick={() => setRefresh(value => value + 1)}>Retry</Button></p> : null}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {categories.map(category => <KpiCard key={category.key} label={category.label} icon={category.icon} value={data ? data.maneuvers[category.key] : "—"} />)}
      </div>
      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <Card className="min-w-0"><CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Maneuver log{data && data.event_summary.detected + data.event_summary.needs_review > data.events.length ? <span className="ml-2 text-xs font-normal text-muted-foreground">Latest {data.events.length}</span> : null}</h2><Button variant="ghost" size="icon" className="size-8" aria-label="Refresh driving analysis" onClick={() => setRefresh(value => value + 1)}><RefreshCcw /></Button></div>
          <div className="min-w-0" role="region" aria-label="Maneuver log">
            {!data ? <p role="status" className="text-sm text-muted-foreground">{error ? "Readings unavailable." : "Loading maneuvers…"}</p> : data.events.length ? <div className="divide-y divide-border">{data.events.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(event => <div key={event.id} className="flex items-start justify-between gap-3 py-3 text-sm"><div><p className="font-medium">{event.target.replaceAll("_", " ").replace(/^./, value => value.toUpperCase())}</p><p className="mt-1 text-xs text-muted-foreground">{event.occurred_at ? formatReturnDateTime(event.occurred_at, true) : "Time unavailable"}</p></div><Badge variant={event.status === "review_required" ? "outline" : "destructive"}>{event.status === "review_required" ? "Uncertain" : "Detected"}</Badge></div>)}</div> : <p className="text-sm text-muted-foreground">{data.latest_received_at ? "No harsh events in received readings." : "No motion readings received."}</p>}
          </div>
          {data && data.events.length > 0 ? <TablePagination page={currentPage} lastPage={lastPage} total={data.events.length} onPageChange={setPage} label="Maneuver log pagination" /> : null}
        </CardContent></Card>
        <Card className="min-w-0"><CardContent className="space-y-3">
          <h2 className="text-sm font-semibold">GPS & Geofence log</h2>
          <div className="min-w-0" role="region" aria-label="GPS and geofence log">
            {activity?.length ? <div className="divide-y divide-border">{activity.slice((currentGpsPage - 1) * ANALYSIS_LOG_PAGE_SIZE, currentGpsPage * ANALYSIS_LOG_PAGE_SIZE).map(event => <div key={event.id} className="space-y-1 py-3 text-sm"><p className="font-medium">{event.type === "geofence_enter" ? "Entered" : "Exited"} {event.zoneName}</p><p className="text-xs text-muted-foreground">{formatReturnDateTime(event.occurredAt, true)}</p></div>)}</div> : <p className="text-sm text-muted-foreground">{activity === undefined ? "Geofence activity unavailable." : "No geofence crossings recorded."}</p>}
            <p className="mt-3 text-xs text-muted-foreground">GPS location history is not available in this report.</p>
          </div>
          {activity && activity.length > 0 ? <TablePagination page={currentGpsPage} lastPage={gpsLastPage} total={activity.length} onPageChange={setGpsPage} label="GPS and geofence log pagination" /> : null}
        </CardContent></Card>
      </div>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Drive summary</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{!data ? "The summary will be available when analysis loads." : `Received RC readings contain ${data.event_summary.detected} confirmed harsh events and ${data.event_summary.needs_review} uncertain maneuvers. ${data.coverage.percent === null ? "Motion coverage is unavailable for this rental." : `The readings cover ${data.coverage.percent}% of the released rental period (${((data.coverage.analyzed_ms ?? 0) / 60000).toFixed(1)} minutes analyzed and ${((data.coverage.uncovered_ms ?? 0) / 60000).toFixed(1)} minutes uncovered).`} ${data.grading.sync_incomplete ? "Sync could not be confirmed for every segment. Some readings may be missing." : data.sync_pending ? "Some readings may still be awaiting synchronization." : ""}`}</p>
      </section>
      {!error ? <ScoreCalculation grading={data?.grading ?? null} /> : null}
    </div>;
  }
  return <Card>
    <CardHeader className="min-h-14 border-b border-border pb-3">
      <CardTitle className="text-sm font-semibold">Driving events</CardTitle>
      <CardDescription className="text-xs">{data ? data.latest_received_at ? `Last received ${formatReturnDateTime(data.latest_received_at)}` : "No motion readings received" : "Loading driving events…"}</CardDescription>
      <CardAction><Button variant="ghost" size="icon" aria-label="Refresh driving events" onClick={() => setRefresh(value => value + 1)}><RefreshCcw /></Button></CardAction>
    </CardHeader>
    <CardContent className="space-y-3">
    {error ? <p role="alert" className="text-sm text-destructive">Driving events unavailable. Refresh to retry.</p> : !data ? <p role="status" className="text-sm text-muted-foreground">Loading driving events…</p> : <>
      <SummaryList label="Driving event totals" items={[{ label: "detected", value: data.event_summary.detected }, { label: "uncertain", value: data.event_summary.needs_review }, ...(data.event_summary.pending ? [{ label: "pending", value: data.event_summary.pending }] : [])]} />
      {data.events.length > 0 ? <div className="divide-y divide-border">
        {data.events.slice((currentPage - 1) * 10, currentPage * 10).map(event => <div key={event.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
          <div>
            <p className="font-medium">{event.target.replaceAll("_", " ").replace(/^./, value => value.toUpperCase())}</p>
            <p className="text-xs text-muted-foreground">{event.occurred_at ? `Occurred ${formatReturnDateTime(event.occurred_at, true)}` : "Event time unavailable"}</p>
          </div>
          <Badge variant={event.status === "review_required" ? "outline" : "destructive"}>{event.status === "review_required" ? "Uncertain" : "Detected"}</Badge>
        </div>)}
      </div> : emptyMessage ? <p className="text-sm text-muted-foreground">{emptyMessage}</p> : null}
      {lastPage > 1 ? <TablePagination page={currentPage} lastPage={lastPage} total={data.events.length} onPageChange={setPage} label="Driving events pagination" /> : null}
    </>}
    </CardContent>
  </Card>;
}
