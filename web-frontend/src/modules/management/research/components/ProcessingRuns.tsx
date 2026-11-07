"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useReviewSelection, useReviewTimeline } from './ReviewTimelineContext';
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { TablePagination } from "@/components/common/tables/TablePagination";
import { MetadataList } from "@/components/common/data-display/MetadataList";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getProcessingRun, getProcessingRuns } from "@/services/research/processing-runs.service";
import type { ProcessingDetail } from "@/services/research/processing-types";
import { formatReturnDateTime } from "@/services/booking/return-time";
import { ApiError } from "@/services/http";
import { filterComparison } from "../filter-preview";
import type { ReferenceRange } from "../forward-reference";
import { seconds } from "../recording-analysis";
import { DetailsList } from "./RecordingDetails";
import { SignalTimeline } from "./SignalTimeline";
import { SignalSelectionControls } from "./SignalSelectionControls";

const labels = { x: "Forward", y: "Right", z: "Up" };
const accelerationAxes = {
  x: { label: "Front–back", positive: "Toward front", negative: "Toward rear" },
  y: { label: "Right–left", positive: "Toward right", negative: "Toward left" },
  z: { label: "Up–down", positive: "Upward", negative: "Downward" },
};
const phaseNames = { rest: "Resting", starting: "Starting", stopping: "Stopping" };
const rangeText = (range: ReferenceRange) => `${seconds(range[0])}–${seconds(range[1])}`;

export function ProcessingRuns({ recordingId, initialResult, viewControl }: { recordingId: string; initialResult: ProcessingDetail | null; viewControl: ReactNode }) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [listing, setListing] = useState<Awaited<ReturnType<typeof getProcessingRuns>> | null>(null);
  const [listError, setListError] = useState<unknown>(null);
  const [listLoading, setListLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProcessingDetail | null>(initialResult);
  const [detailError, setDetailError] = useState<unknown>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const autoOpen = useRef(!initialResult);
  useEffect(() => {
    const controller = new AbortController();
    getProcessingRuns(recordingId, page, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      setListing(data); setListError(null);
      if (autoOpen.current) {
        autoOpen.current = false;
        const first = data.runs[0];
        if (first) { setDetailLoading(true); setSelectedId(first.id); }
      }
    }).catch(error => { if (!controller.signal.aborted) setListError(error); })
      .finally(() => { if (!controller.signal.aborted) setListLoading(false); });
    return () => controller.abort();
  }, [recordingId, page, revision]);
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    getProcessingRun(recordingId, selectedId, controller.signal).then(data => { if (!controller.signal.aborted) { setDetail(data); setDetailError(null); } })
      .catch(error => { if (!controller.signal.aborted) setDetailError(error); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [recordingId, selectedId, retry]);
  const denied = (error: unknown) => error instanceof ApiError && error.status === 403;
  const savedControl = listing && listing.runs.length > 0 && !listError ? <div className="flex min-w-0 items-center gap-2 sm:ml-auto">
    {listing.total > 1 ? <FilterSelect height="compact" ariaLabel="Saved processing run" className="w-full sm:w-64" placeholder="Saved result" value={selectedId ?? detail?.run.id ?? ""}
      disabled={listLoading} onValueChange={id => { setDetailLoading(true); setDetailError(null); setDetail(null); setSelectedId(id); setRetry(v => v + 1); }}
      options={listing.runs.map(run => ({ value: run.id, label: `${run.cutoff_hz} Hz`, description: formatReturnDateTime(run.created_at) }))} />
      : <div className="text-xs"><p className="font-medium">{listing.runs[0].cutoff_hz} Hz</p><p className="mt-0.5 text-muted-foreground">{formatReturnDateTime(listing.runs[0].created_at)}</p></div>}
    <Button size="icon" variant="ghost" className="rounded-xl" disabled={listLoading} aria-label="Refresh saved results" onClick={() => { setListLoading(true); setRevision(v => v + 1); }}>
      <RefreshCw className={`size-4 ${listLoading ? "animate-spin" : ""}`} aria-hidden="true" />
    </Button>
  </div> : null;
  const showResult = !detailLoading && !detailError && detail;
  return <section className="space-y-4" aria-label="Processed readings">
    {!showResult && <div className="flex flex-wrap items-center gap-2">{viewControl}{savedControl}</div>}
    {listLoading && !listing ? <p role="status" className="text-xs text-muted-foreground">Loading saved results...</p>
      : listError ? <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{denied(listError) ? "Research access is unavailable." : "Saved results could not be loaded."}</p>
        {!denied(listError) && <Button size="sm" variant="outline" onClick={() => { setListLoading(true); setRevision(v => v + 1); }}>Try again</Button>}</div>
        : listing && listing.runs.length > 0 ? <>
          {listing.lastPage > 1 && <TablePagination page={listing.page} lastPage={listing.lastPage} total={listing.total} onPageChange={value => {
            setListLoading(true); setDetail(null); setSelectedId(null); setDetailError(null); autoOpen.current = true; setPage(value);
          }} label="Processing runs pagination" />}
        </> : <p className="py-8 text-center text-sm text-muted-foreground">No saved processing result.</p>}
    {detailLoading ? <p role="status" className="text-xs text-muted-foreground">Loading processed readings...</p>
      : detailError ? <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{denied(detailError) ? "Research access is unavailable." : "The processing result could not be loaded or verified."}</p>
        {!denied(detailError) && <Button size="sm" variant="outline" onClick={() => { setDetailLoading(true); setRetry(v => v + 1); }}>Try again</Button>}</div>
        : detail && <ProcessingRunResult key={detail.run.id} detail={detail} viewControl={viewControl} savedControl={savedControl} />}
  </section>;
}

function ProcessingRunResult({ detail: { run, result }, viewControl, savedControl }: { detail: ProcessingDetail; viewControl: ReactNode; savedControl: ReactNode }) {
  const bounds: ReferenceRange = [result.config.start_ms, result.config.end_ms];
  const shared = useReviewTimeline();
  const setStart = shared?.setStart, setWindowSize = shared?.setWindowSize;
  useEffect(() => {
    setStart?.(result.config.start_ms);
    setWindowSize?.(result.config.end_ms - result.config.start_ms);
  }, [result.config.start_ms, result.config.end_ms, setStart, setWindowSize]);
  const { selection, setSelection, cursor, setCursor } = useReviewSelection(bounds);
  const [channel, setChannel] = useState<"acceleration" | "gyroscope">("acceleration");
  const [compare, setCompare] = useState(false);
  const signals = result.signals[channel];
  const comparison = filterComparison(signals, selection);
  const unit = channel === "acceleration" ? "m/s²" : "rad/s";
  const phaseRanges = result.config.ranges;
  const origin = result.reference_origin;
  const interval = (["rest", "starting", "stopping"] as const).find(phase => phaseRanges?.[phase].every((v, i) => v === selection[i]))
    ?? (selection.every((v, i) => v === bounds[i]) ? "whole" : "custom");
  const rowIndex = Math.max(0, Math.min(result.rows.length - 1, Math.round((cursor - result.rows[0].time) / result.settings.grid_ms)));
  const row = result.rows[rowIndex];
  const after = signals.after[rowIndex];
  const pairedAfter = result.signals.acceleration.after.filter((point, index) => point.x !== null && result.signals.gyroscope.after[index].x !== null).length;
  const metric = (axis: typeof comparison.axes[number], key: "mean" | "std" | "peak") => axis.after
    ? `${compare ? `${axis.before![key].toFixed(4)} / ` : ""}${axis.after[key].toFixed(4)}` : "Unavailable";
  const directionalPeak = (axis: typeof comparison.axes[number], key: "positivePeak" | "negativePeak") => {
    const format = (value: number | null) => value === null ? "None" : `${value > 0 ? "+" : ""}${value.toFixed(4)}`;
    return axis.after ? `${compare ? `${format(axis.before![key])} / ` : ""}${format(axis.after[key])}` : "Unavailable";
  };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      {viewControl}
      <FilterSelect height="compact" ariaLabel="Processed sensor channel" className="w-full sm:w-40" value={channel} onValueChange={setChannel}
        options={[{ value: "acceleration", label: "Acceleration" }, { value: "gyroscope", label: "Rotation" }]} />
      <FilterSelect height="compact" ariaLabel="Review interval" className="w-full sm:w-40" value={interval} onValueChange={value => {
        if (value === "whole") setSelection(bounds);
        else if (phaseRanges && (value === "rest" || value === "starting" || value === "stopping")) setSelection([...phaseRanges[value]]);
      }} options={[{ value: "whole", label: "Whole window" }, ...(phaseRanges ? (["rest", "starting", "stopping"] as const).map(phase => ({ value: phase, label: phaseNames[phase] })) : []),
        ...(interval === "custom" ? [{ value: "custom", label: "Custom interval" }] : [])]} />
      <Button className="rounded-xl" variant={compare ? "default" : "outline"} aria-label="Compare before and after filtering" aria-pressed={compare} onClick={() => setCompare(v => !v)}>Compare</Button>
      {savedControl}
    </div>
    <SignalTimeline key={channel} title={channel === "acceleration" ? "Vehicle acceleration" : "Vehicle rotation"} unit={unit}
      points={compare ? signals.before : signals.after} comparison={compare ? { points: signals.after, label: "After" } : undefined}
      domain={bounds} selection={selection} cursor={cursor} onCursor={setCursor} onSelection={setSelection} syncId={run.id}
      axisLabels={labels} frameLabel="Vehicle" initialAxes={channel === "acceleration" ? ["x"] : ["z"]} />
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{rangeText(selection)}</h3>
        <MetadataList className="sm:grid-cols-3" items={[{ label: 'Readings', value: comparison.paired }, ...(comparison.warmup > 0 ? [{ label: 'Warm-up', value: comparison.warmup }] : []), ...(comparison.missing > 0 ? [{ label: 'Missing', value: comparison.missing }] : [])]} />
      </div>
      {comparison.paired === 0 ? <p className="text-xs text-muted-foreground">No values after warm-up.</p> : <Table>
        {compare && <caption className="pb-2 text-left text-xs text-muted-foreground">Matching readings before / after filtering</caption>}
        <TableHeader><TableRow><TableHead>Axis</TableHead><TableHead>Mean ({unit})</TableHead><TableHead>Positive peak ({unit})</TableHead><TableHead>Negative peak ({unit})</TableHead></TableRow></TableHeader>
        <TableBody>{comparison.axes.map(axis => <TableRow key={axis.axis}><TableCell className="font-medium">{channel === "acceleration" ? accelerationAxes[axis.axis].label : labels[axis.axis]}</TableCell>
          <TableCell className="tabular-nums">{metric(axis, "mean")}</TableCell>
          <TableCell className="tabular-nums">{directionalPeak(axis, "positivePeak")}
            {channel === "acceleration" && <span className="block text-xs text-muted-foreground">{accelerationAxes[axis.axis].positive}</span>}
          </TableCell>
          <TableCell className="tabular-nums">{directionalPeak(axis, "negativePeak")}
            {channel === "acceleration" && <span className="block text-xs text-muted-foreground">{accelerationAxes[axis.axis].negative}</span>}
          </TableCell>
        </TableRow>)}</TableBody>
      </Table>}
    </div>
    <div className="space-y-1 text-xs text-muted-foreground">
      {result.reference.warnings.map(warning => <p key={warning}>{warning}</p>)}
    </div>
    <details className="text-xs"><summary className="min-h-9 cursor-pointer font-medium text-primary">Details</summary>
      <div className="mt-3 space-y-4">
        <SignalSelectionControls bounds={bounds} selection={selection} onSelection={setSelection} />
        <DetailsList items={[
          ["Time range", rangeText(selection)], ["Filter", `${run.cutoff_hz} Hz`],
          ["Reference", origin ? <Link className="text-primary underline-offset-4 hover:underline" href={`/admin/research/native/${origin.recording_id}`}>{origin.recording_name}</Link> : "This recording"],
          ...(origin ? [["Phone mount", "Operator confirmed unchanged mount"] as [string, string]] : []),
          ["Usable readings", comparison.paired.toLocaleString()],
        ]} />
        <div className="space-y-3">
          <h4 className="font-medium">Standard deviation ({unit})</h4>
          {compare ? <p className="text-muted-foreground">Before / after filtering</p> : null}
          <DetailsList items={comparison.axes.map(axis => [channel === "acceleration" ? accelerationAxes[axis.axis].label : labels[axis.axis], metric(axis, "std")])} />
        </div>
        <p className="leading-relaxed text-muted-foreground">Fixed reference; phone tilt can affect acceleration.</p>
        <details><summary className="min-h-9 cursor-pointer font-medium text-primary">Advanced diagnostics</summary>
          <div className="mt-3 space-y-4">
            <div className="space-y-3">
              <h4 className="font-medium">Processing</h4>
              <DetailsList items={[["Window", rangeText(bounds)], ["Pipeline", run.version], ["Reference fitting", origin ? "Reused source reference" : "Original independent channels"],
                ["Synchronized / filtered paired rows", `${result.counts.paired} / ${pairedAfter}`], ["Grid / restart exclusion", `${result.settings.grid_ms} ms / ${result.settings.warmup_ms} ms`],
                ...Object.entries(result.methods).map(([key, value]): [string, string] => [key.charAt(0).toUpperCase() + key.slice(1), value]),
                ["Interpolation limit (ms)", String(result.settings.max_interpolation_ms)], ["Filter b", result.settings.b.map(v => v.toFixed(9)).join(" / ")],
                ["Filter a", result.settings.a.map(v => v.toFixed(9)).join(" / ")],
                ...(phaseRanges ? (["rest", "starting", "stopping"] as const).map((phase): [string, string] => [phaseNames[phase], rangeText(phaseRanges[phase])]) : []),
              ]} />
            </div>
            {origin && <div className="space-y-3">
              <h4 className="font-medium">Reference source</h4>
              <DetailsList items={[["Reference run", origin.run_id], ["Reference pipeline", origin.version], ["Reference window (source time)", rangeText(origin.window)],
                ...(["rest", "starting", "stopping"] as const).map((phase): [string, string] => [`Reference ${phaseNames[phase].toLowerCase()} (source time)`, rangeText(origin.ranges[phase])]),
                ["Reference fingerprint", origin.run_fingerprint], ["Reference payload SHA-256", origin.payload_sha256], ["Reference manifest SHA-256", origin.manifest_sha256],
                ["Reference inventory SHA-256", origin.chunk_inventory_sha256], ["Setup SHA-256", origin.setup_sha256]]} />
            </div>}
            <div className="space-y-3">
              <h4 className="font-medium">Verification</h4>
              <DetailsList items={[["Source manifest SHA-256", result.source.manifest_sha256], ["Chunk inventory SHA-256", result.source.chunk_inventory_sha256], ["Run fingerprint", run.fingerprint]]} />
            </div>
            <div className="space-y-3">
              <h4 className="font-medium">Alignment and cursor</h4>
              <DetailsList items={result.reference.rotation_rfu.map((v, index) => [["Right row", "Forward row", "Up row"][index], v.map(n => n.toFixed(6)).join(" / ")])} />
              <DetailsList items={[["Cursor grid time", seconds(row.time)], ["Source state", row[channel].state],
                ["Source bracket timestamps (ns)", row[channel].source_times_ns?.join(" / ") ?? "Unavailable"],
                ["Filtered forward / right / up", after.x === null ? signals.warmup[rowIndex] ? "Warm-up" : "Missing" : [after.x, after.y!, after.z!].map(v => v.toFixed(5)).join(" / ")]]} />
            </div>
            <p className="leading-relaxed text-muted-foreground">Compare uses the same fixed axes and resting offsets; gaps stay missing and restart each channel.</p>
            <p className="leading-relaxed text-muted-foreground">Experimental result; not training approval.</p>
          </div>
        </details>
      </div>
    </details>
  </div>;
}
