"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { SearchInput } from "@/components/common/forms/SearchInput";
import { TablePagination } from "@/components/common/tables/TablePagination";
import { ManagementTable as Table, ManagementTableCell as TableCell, TableCard } from "@/components/common/tables/ManagementTable";
import { TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { TableActionMenu } from "@/components/common/tables/TableActionMenu";
import { getNativeRecordings } from "@/services/research/native-research.service";
import { formatReturnDateTime } from "@/services/booking/return-time";
import { ResearchState } from "./components/ResearchState";
import { humanize, seconds } from "./recording-analysis";
import { MetadataList } from "@/components/common/data-display/MetadataList";
import { recordingPresentation, recordingSearchTerm } from "./recording-presentation";
import exerciseCatalog from "./rc-exercises-v6.json";

export function NativeRecordings({ revision }: { revision: number }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState("all");
  const [sessionId, setSessionId] = useState("all");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Awaited<ReturnType<typeof getNativeRecordings>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError(null);
      try {
        const response = await getNativeRecordings({
          page,
          search: recordingSearchTerm(search),
          groupId: groupId === "all" ? undefined : groupId,
          sessionId: sessionId === "all" ? undefined : sessionId,
        }, controller.signal);
        if (!controller.signal.aborted) setResult(response);
      }
      catch (cause) { if (!controller.signal.aborted) setError(cause); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [page, search, groupId, sessionId, revision, retry]);

  const sessions = result?.filterSessions ?? [];
  const groups = new Map<string, string>();
  for (const session of sessions) {
    if (groups.has(session.group_id)) continue;
    const { metadata } = recordingPresentation({ name: session.recording_name });
    const group = metadata.find(item => item.label === "Group")?.value;
    groups.set(session.group_id, group ? `${group} (${session.surface})` : session.surface);
  }
  const sessionOptions = sessions.filter(session => groupId === "all" || session.group_id === groupId);
  const hasFilters = Boolean(search.trim()) || groupId !== "all" || sessionId !== "all";

  function changeGroup(value: string) {
    setGroupId(value);
    if (value !== "all" && !sessions.some(session => session.id === sessionId && session.group_id === value)) {
      setSessionId("all");
    }
    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setGroupId("all");
    setSessionId("all");
    setPage(1);
  }

  return (
    <TableCard aria-label="Research recordings">
      <CardContent className="border-b border-border p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <SearchInput
            value={search}
            onValueChange={value => { setSearch(value.slice(0, 100)); setPage(1); }}
            placeholder="Search recording or surface..."
            wrapperClassName="min-w-0 basis-full sm:flex-1 sm:basis-56"
          />
          <FilterSelect
            value={groupId}
            onValueChange={changeGroup}
            ariaLabel="Filter recordings by group"
            disabled={!groups.size}
            className="min-w-0 flex-1 basis-36 sm:w-52 sm:flex-none sm:basis-auto"
            options={[{ value: "all", label: "All groups" }, ...Array.from(groups, ([value, label]) => ({ value, label }))]}
          />
          <FilterSelect
            value={sessionId}
            onValueChange={value => { setSessionId(value); setPage(1); }}
            ariaLabel="Filter recordings by session"
            disabled={!sessionOptions.length}
            className="min-w-0 flex-1 basis-36 sm:w-52 sm:flex-none sm:basis-auto"
            options={[{ value: "all", label: "All sessions" }, ...sessionOptions.map(session => ({
              value: session.id,
              label: `S${String(session.session_number).padStart(2, "0")}${groupId === "all" ? ` (${session.surface})` : ""}`,
            }))]}
          />
          {hasFilters && <Button type="button" variant="ghost" className="h-11 text-sm text-muted-foreground" onClick={clearFilters}>Clear</Button>}
        </div>
      </CardContent>
      {loading || error || !result?.recordings.length ? (
        <ResearchState className="rounded-none border-0" loading={loading} error={error} filtered={hasFilters} onRetry={() => setRetry(v => v + 1)} />
      ) : (
        <>
          <Table>
            <colgroup>
              <col style={{ width: "36%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "3.5rem" }} />
            </colgroup>
            <TableHeader>
              <TableRow className="border-b border-border bg-background hover:bg-background">
                {["Recording", "Maneuver", "Duration", "Timestamp", "Labels", "Actions"].map(title => (
                  <TableHead key={title}>{title === "Actions" ? <span className="sr-only">Actions</span> : title}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.recordings.map(record => {
                const presentation = recordingPresentation({ name: record.name, displayCode: record.display_code, surface: record.surface });
                const protocolCode = record.display_code?.split("-")[1];
                const maneuver = exerciseCatalog.protocols.find(protocol => protocol.code === protocolCode)?.label ?? "Unavailable";
                return (
                <TableRow key={record.id}>
                  <TableCell data-label="Recording">
                    <Link aria-label={record.display_code ?? record.name} className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline" href={`/admin/research/native/${record.id}`}>
                      {presentation.title}
                    </Link>
                    {presentation.metadata.length ? <MetadataList className={presentation.metadata.length > 3 ? "mt-2" : "mt-2 grid-cols-3 gap-x-3"} items={presentation.metadata} /> : null}
                  </TableCell>
                  <TableCell data-label="Maneuver" className="text-muted-foreground">{maneuver}</TableCell>
                  <TableCell data-label="Duration" className="tabular-nums text-muted-foreground">{seconds(record.duration_ms)}</TableCell>
                  <TableCell data-label="Timestamp" className="text-muted-foreground">{formatReturnDateTime(record.started_at)}</TableCell>
                  <TableCell data-label="Labels"><Badge variant="outline" className="border-border bg-background text-muted-foreground">{humanize(record.annotation_state)}</Badge></TableCell>
                  <TableCell data-label="Actions">
                    <TableActionMenu label={`Open actions for ${record.display_code ?? record.name}`} items={[
                      { label: "View", icon: <Eye size={13} className="mr-2" />, onClick: () => router.push(`/admin/research/native/${record.id}`) },
                    ]} />
                  </TableCell>
                </TableRow>
              ); })}
            </TableBody>
          </Table>
          <div className="border-t border-border px-4 py-3 [&>div]:mt-0">
            <TablePagination page={result.page} lastPage={result.lastPage} total={result.total} onPageChange={setPage} label="Native recordings pagination" />
          </div>
        </>
      )}
    </TableCard>
  );
}
