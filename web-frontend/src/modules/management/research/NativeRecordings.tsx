"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SearchInput } from "@/components/common/forms/SearchInput";
import { TablePagination } from "@/components/common/tables/TablePagination";
import { ManagementTable as Table, ManagementTableCell as TableCell, TableCard } from "@/components/common/tables/ManagementTable";
import { TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getNativeRecordings } from "@/services/research/native-research.service";
import { formatReturnDateTime } from "@/services/booking/return-time";
import { ResearchState } from "./components/ResearchState";
import { seconds } from "./recording-analysis";

export function NativeRecordings({ revision }: { revision: number }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Awaited<ReturnType<typeof getNativeRecordings>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError(null);
      try { const response = await getNativeRecordings(page, search, controller.signal); if (!controller.signal.aborted) setResult(response); }
      catch (cause) { if (!controller.signal.aborted) setError(cause); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [page, search, revision, retry]);
  return <div className="space-y-5">
    <SearchInput value={search} onValueChange={value => { setSearch(value.slice(0, 100)); setPage(1); }} placeholder="Search recording or surface..." />
    {loading || error || !result?.recordings.length ? <ResearchState loading={loading} error={error} onRetry={() => setRetry(v => v + 1)} /> : <>
      <TableCard><Table><TableHeader><TableRow className="border-b border-border bg-background hover:bg-background">
        {["Recording", "Duration", "Upload", "Capture", "Labels"].map(title => <TableHead key={title} className="px-4 py-3 text-[10.5px] font-semibold uppercase tracking-wider text-subtle-foreground">{title}</TableHead>)}
      </TableRow></TableHeader><TableBody>{result.recordings.map(record => <TableRow key={record.id} className="border-b border-background hover:bg-background">
        <TableCell data-label="Recording" className="px-4 py-3"><Link className="text-[12.5px] font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline" href={`/admin/research/native/${record.id}`}>{record.name}</Link><p className="mt-1 text-xs text-muted-foreground">{formatReturnDateTime(record.started_at)}</p></TableCell>
        <TableCell data-label="Duration" className="px-4 py-3 text-xs">{seconds(record.duration_ms)}</TableCell>
        <TableCell data-label="Upload" className="px-4 py-3"><Badge variant="outline">{record.state === "verified" ? "Integrity verified" : `${record.received_chunks}/${record.expected_chunks} chunks`}</Badge></TableCell>
        <TableCell data-label="Capture" className="px-4 py-3 text-xs">{record.capture_state === "interrupted" ? "Interrupted" : "Stopped"}</TableCell>
        <TableCell data-label="Labels" className="px-4 py-3"><Badge variant="secondary">Unlabeled</Badge></TableCell>
      </TableRow>)}</TableBody></Table></TableCard>
      <TablePagination page={result.page} lastPage={result.lastPage} total={result.total} onPageChange={setPage} label="Native recordings pagination" />
    </>}
  </div>;
}
