"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { TablePagination } from "@/components/common/tables/TablePagination";
import { TABLE_PAGE_SIZE } from "@/lib/table-pagination";
import { getAnnotationHistory, getAnnotationRevision, type AnnotationRevision } from "@/services/research/annotations.service";
import { formatReturnDateTime } from "@/services/booking/return-time";
import { humanize, seconds } from "../recording-analysis";
import { ResearchState } from "./ResearchState";
import { MetadataList } from "@/components/common/data-display/MetadataList";
import { hasInitialDeviation } from "@/validations/research/annotations";

export function AnnotationHistory({ recordingId }: { recordingId: string }) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [listing, setListing] = useState<Awaited<ReturnType<typeof getAnnotationHistory>> | null>(null);
  const [selected, setSelected] = useState<AnnotationRevision | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [intervalPage, setIntervalPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    const c = new AbortController();
    const fetch = async () => {
      try {
        if (selectedId) {
          const data = await getAnnotationRevision(recordingId, selectedId, c.signal);
          if (!c.signal.aborted) setSelected(data);
        } else {
          const data = await getAnnotationHistory(recordingId, page, c.signal);
          if (!c.signal.aborted) setListing(data);
        }
        if (!c.signal.aborted) setError(null);
      } catch (e) { if (!c.signal.aborted) setError(e); }
      finally { if (!c.signal.aborted) setLoading(false); }
    };
    void fetch(); return () => c.abort();
  }, [recordingId, page, selectedId, revision]);
  if (loading || error) return <ResearchState loading={loading} error={error} onRetry={() => { setLoading(true); setRevision(v => v + 1); }} />;
  if (selectedId && selected) return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-medium">Revision {selected.revision}</p><p className="mt-0.5 text-xs text-muted-foreground">Read only</p></div>
      <Button variant="ghost" size="sm" onClick={() => { setSelected(null); setSelectedId(null); }}>Back to history</Button></div>
    {selected.intervals.length === 0 && <p className="text-xs text-muted-foreground">No labeled intervals in this revision.</p>}
    {selected.intervals.slice((intervalPage - 1) * TABLE_PAGE_SIZE, intervalPage * TABLE_PAGE_SIZE).map((item, i) => <div key={i} className="space-y-1 border-b border-border pb-3 text-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><p className="font-medium">{humanize(item.movement)}</p><p className="text-muted-foreground">{seconds(item.start_ms)}–{seconds(item.end_ms)}</p></div>
      <MetadataList items={[
        { label: 'Direction', value: humanize(item.direction) }, { label: 'Severity', value: humanize(item.severity) },
        { label: 'Certainty', value: humanize(item.certainty) }, { label: 'Source', value: humanize(item.source) },
        ...(hasInitialDeviation(item.movement) ? [{ label: 'Initial deviation', value: item.initial_deviation ? humanize(item.initial_deviation) : 'Not recorded' }] : []),
      ]} />
      {item.notes && <p className="whitespace-pre-wrap">{item.notes}</p>}
    </div>)}
    {selected.intervals.length > TABLE_PAGE_SIZE && <TablePagination page={intervalPage} lastPage={Math.ceil(selected.intervals.length / TABLE_PAGE_SIZE)} total={selected.intervals.length} onPageChange={setIntervalPage} />}
  </div>;
  return <div className="space-y-2">
    {listing?.revisions.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 text-xs">
      <div className="min-w-0 flex-1"><div className="flex flex-wrap gap-x-4 gap-y-1"><p className="font-medium">Revision {item.revision}</p><p className="text-muted-foreground">{humanize(item.state)}</p></div><p className="mt-1 text-muted-foreground">{formatReturnDateTime(item.created_at)}</p></div>
      <Button variant="outline" size="sm" onClick={() => { setIntervalPage(1); setLoading(true); setSelectedId(item.id); }}>View</Button>
    </div>)}
    {listing?.total === 0 && <p className="text-xs text-muted-foreground">No saved revisions.</p>}
    {listing && listing.lastPage > 1 && <TablePagination {...listing} onPageChange={v => { setLoading(true); setPage(v); }} />}
  </div>;
}
