"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, RefreshCw } from "lucide-react";
import { ManagementPageHeading } from "@/modules/management/shell/components/ManagementPageHeading";
import { ManagementTable as Table, ManagementTableCell as TableCell, TableCard } from "@/components/common/tables/ManagementTable";
import { TablePagination } from "@/components/common/tables/TablePagination";
import { TableActionMenu } from "@/components/common/tables/TableActionMenu";
import { SearchInput } from "@/components/common/forms/SearchInput";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatReturnDateTime } from "@/services/booking/return-time";
import { getResearchRecordings } from "@/services/research/research.service";
import type { ResearchRecordingsPage } from "@/services/research/types";
import { maneuverLabel, seconds } from "./recording-analysis";
import { ResearchState } from "./components/ResearchState";

export function ResearchModule() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [label, setLabel] = useState<"all" | "confirmed" | "uncertain">("all");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<ResearchRecordingsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError(null);
      try {
        const response = await getResearchRecordings({ page, search, label_status: label === "all" ? undefined : label }, controller.signal);
        if (!controller.signal.aborted) setResult(response);
      } catch (cause) { if (!controller.signal.aborted) { setResult(null); setError(cause); } }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [page, search, label, revision]);

  return <section className="space-y-5 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <ManagementPageHeading title="RC Research" description="Inspect recordings, signal quality, and observed driving maneuvers." />
      <Button variant="outline" disabled={loading} onClick={() => setRevision((value) => value + 1)}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
    </header>
    <Card className="rounded-2xl border-0 bg-surface shadow-[0_2px_12px_rgba(0,0,0,0.05)]"><CardContent className="flex flex-col gap-3 sm:flex-row">
      <SearchInput value={search} onValueChange={(value) => { setSearch(value.slice(0, 100)); setPage(1); }} placeholder="Search session, surface, or device..." wrapperClassName="min-w-0 flex-1" />
      <FilterSelect value={label} onValueChange={(value) => { setLabel(value); setPage(1); }} ariaLabel="Filter observer labels" className="sm:w-52" options={[
        { value: "all", label: "All observer labels" }, { value: "confirmed", label: "Confirmed labels" }, { value: "uncertain", label: "Uncertain labels" },
      ]} />
    </CardContent></Card>
    {loading || error ? <ResearchState loading={loading} error={error} onRetry={() => setRevision((value) => value + 1)} /> : !result?.recordings.length ? (
      search || label !== "all" ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No recordings match these filters.</CardContent></Card> : <ResearchState />
    ) : <>
      <TableCard><Table><TableHeader><TableRow className="border-b border-border bg-background hover:bg-background">
        {["Recording", "Observed maneuver", "Duration / samples", "Data quality", "Observer label", "Actions"].map((heading) => <TableHead key={heading} className="px-4 py-3 text-[10.5px] font-semibold uppercase tracking-wider text-subtle-foreground">{heading === "Actions" ? <span className="sr-only">Actions</span> : heading}</TableHead>)}
      </TableRow></TableHeader><TableBody>{result.recordings.map((record) => <TableRow key={record.id} className="border-b border-background hover:bg-background">
        <TableCell data-label="Recording" className="px-4 py-3"><Link href={`/admin/research/${record.id}`} className="text-[12.5px] font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline">{record.session.name}</Link><p className="mt-1 text-xs text-muted-foreground">{formatReturnDateTime(record.started_at)}</p>{record.session.app_version === "synthetic-demo" && <Badge variant="outline" className="mt-1">Demo data</Badge>}</TableCell>
        <TableCell data-label="Observed maneuver" className="px-4 py-3 text-[12px]">{maneuverLabel(record.observed_movement, record.observed_intensity)}</TableCell>
        <TableCell data-label="Duration / samples" className="px-4 py-3 text-[12px]"><p>{seconds(record.summary.duration_ms)}</p><p className="mt-1 text-muted-foreground">{record.summary.sample_count.toLocaleString()} samples · {record.summary.mean_rate_hz.toFixed(1)} Hz</p></TableCell>
        <TableCell data-label="Data quality" className="px-4 py-3"><Badge variant="outline" className={record.quality !== "usable" || record.summary.quality_flags.length ? "border-warning-border bg-warning-surface text-warning" : "border-success-border bg-success-surface text-success"}>{record.quality !== "usable" || record.summary.quality_flags.length ? "Check recording" : "No v1 flags"}</Badge></TableCell>
        <TableCell data-label="Observer label" className="px-4 py-3"><Badge variant={record.label_status === "confirmed" ? "secondary" : "outline"}>{record.label_status === "confirmed" ? "Confirmed" : "Uncertain"}</Badge></TableCell>
        <TableCell data-label="Actions" className="px-4 py-3"><TableActionMenu label={`Actions for ${record.session.name}`} items={[{ label: "Inspect recording", icon: <Eye className="mr-2 size-3.5" />, onClick: () => router.push(`/admin/research/${record.id}`) }]} /></TableCell>
      </TableRow>)}</TableBody></Table></TableCard>
      <TablePagination total={result.total} page={result.page} lastPage={result.lastPage} onPageChange={setPage} label="Recordings pagination" />
    </>}
  </section>;
}
