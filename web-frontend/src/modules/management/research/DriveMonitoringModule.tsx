"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Eye, RefreshCw } from "lucide-react";
import { ManagementPageHeading } from "@/modules/management/shell/components/ManagementPageHeading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ManagementTable, ManagementTableCell, TableCard } from "@/components/common/tables/ManagementTable";
import { TableActionMenu } from "@/components/common/tables/TableActionMenu";
import { TablePagination } from "@/components/common/tables/TablePagination";
import { getMonitoringSession, getMonitoringSessions } from "@/services/research/drive-monitoring.service";
import { formatReturnDateTime } from "@/services/booking/return-time";
import { ApiError } from "@/services/http";
import { seconds } from "./recording-analysis";
import { MonitoringSessionDetails } from "./components/MonitoringSessionDetails";

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Sign in again to view monitoring.";
    if (error.status === 403) return "Drive Monitoring is unavailable for this account.";
    if (error.status === 404) return "This monitoring session could not be found.";
  }
  return "Monitoring could not be refreshed. Check your connection and retry.";
}

export function DriveMonitoringModule() {
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState<Awaited<ReturnType<typeof getMonitoringSessions>> | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getMonitoringSession>> | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      let poll = true;
      try {
        if (selected) {
          const response = await getMonitoringSession(selected, controller.signal);
          if (!controller.signal.aborted) setDetail(response);
          poll = response.data.session.status === "active";
        } else {
          const response = await getMonitoringSessions(page, controller.signal);
          if (!controller.signal.aborted) setList(response);
        }
        if (!controller.signal.aborted) setError(null);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause);
        poll = !(cause instanceof ApiError && [401, 403, 404].includes(cause.status));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          if (poll) timer = setTimeout(refresh, 2000);
        }
      }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [page, revision, selected]);

  function open(id: string | null) {
    setLoading(true); setError(null); setDetail(null); setSelected(id);
  }
  const blocked = error instanceof ApiError && [401, 403, 404].includes(error.status);
  const hasData = !blocked && (selected ? Boolean(detail) : Boolean(list));
  return <section className="space-y-5 p-4 sm:p-6 lg:p-8">
    <header className="flex items-start justify-between gap-4">
      <ManagementPageHeading title="Drive Monitoring" description="Review driving events and received readings." />
      <Button variant="outline" size="icon" aria-label="Refresh monitoring" disabled={loading}
        onClick={() => { setLoading(true); setRevision(value => value + 1); }}><RefreshCw className="size-4" /></Button>
    </header>
    {selected && <div className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" onClick={() => open(null)}><ArrowLeft className="size-4" /> Sessions</Button>
      {detail && <span className="text-sm font-medium">{formatReturnDateTime(detail.data.session.created_at)}</span>}
    </div>}
    {Boolean(error) && <p role="alert" className="text-sm text-destructive">{errorMessage(error)}</p>}
    {loading && !hasData ? <Card><CardContent role="status" className="text-muted-foreground">Loading monitoring…</CardContent></Card>
      : !hasData && error ? null
      : selected && detail && !blocked ? <MonitoringSessionDetails data={detail.data} />
      : !selected && !blocked ? <TableCard aria-label="Monitoring sessions">
        {!list?.data.length ? <CardContent className="py-6 text-sm text-muted-foreground">No monitoring sessions yet.</CardContent> : <ManagementTable>
          <TableHeader><TableRow>
            {["Started", "Collection", "Analyzed through", "Status", "Actions"].map(label => <TableHead key={label}>{label === "Actions" ? <span className="sr-only">Actions</span> : label}</TableHead>)}
          </TableRow></TableHeader>
          <TableBody>{list.data.map(session => <TableRow key={session.id}>
            <ManagementTableCell data-label="Started"><Button variant="link" className="h-auto whitespace-normal px-0 py-0 text-left font-semibold" onClick={() => open(session.id)}>{formatReturnDateTime(session.created_at)}</Button></ManagementTableCell>
            <ManagementTableCell data-label="Collection">{session.research_session_number ? `S${String(session.research_session_number).padStart(2, "0")}` : "—"}</ManagementTableCell>
            <ManagementTableCell data-label="Analyzed through" className="tabular-nums">{session.analyzed_through_ms ? seconds(session.analyzed_through_ms) : "No readings"}</ManagementTableCell>
            <ManagementTableCell data-label="Status"><Badge variant="outline">{session.status === "active" ? "Open" : "Stopped"}</Badge></ManagementTableCell>
            <ManagementTableCell data-label="Actions"><TableActionMenu label={`Actions for monitoring from ${formatReturnDateTime(session.created_at)}`} items={[
              { label: "View", icon: <Eye size={13} className="mr-2" />, onClick: () => open(session.id) },
            ]} /></ManagementTableCell>
          </TableRow>)}</TableBody>
        </ManagementTable>}
        {Number(list?.meta?.last_page ?? 1) > 1 && <CardContent className="border-t border-border py-3"><TablePagination page={page}
          lastPage={Number(list?.meta?.last_page)} total={Number(list?.meta?.total ?? 0)} disabled={loading}
          onPageChange={value => { setLoading(true); setList(null); setPage(value); }} label="Monitoring sessions pagination" /></CardContent>}
      </TableCard> : null}
  </section>;
}
