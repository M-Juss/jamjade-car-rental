"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReferenceRange } from "../forward-reference";
import { FILTER_CUTOFFS, FILTER_VERSION, FILTER_WARMUP_MS, filterComparison, lowPassPreview, type FilterCutoff } from "../filter-preview";
import type { SignalPoint } from "../recording-analysis";
import { seconds } from "../recording-analysis";
import { DetailsList } from "./RecordingDetails";
import { SignalTimeline } from "./SignalTimeline";

export function FilterPreview({ acceleration, gyroscope, bounds, selection, cursor, onCursor, onSelection, syncId }: {
  acceleration: SignalPoint[]; gyroscope: SignalPoint[]; bounds: ReferenceRange; selection: ReferenceRange;
  cursor: number; onCursor: (time: number) => void; onSelection: (range: ReferenceRange) => void; syncId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [cutoff, setCutoff] = useState<FilterCutoff>(5);
  const [channel, setChannel] = useState<"acceleration" | "gyroscope">("acceleration");
  const result = useMemo(() => expanded ? lowPassPreview(acceleration, gyroscope, cutoff) : null, [expanded, acceleration, gyroscope, cutoff]);
  const signals = result?.available ? result[channel] : null;
  const comparison = signals ? filterComparison(signals, selection) : null;
  const unit = channel === "acceleration" ? "m/s²" : "rad/s";
  return <section className="space-y-4 border-t border-border pt-5" aria-label="Vibration filter preview">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-semibold">Vibration filter · preview</h4>
      <Button size="sm" variant="outline" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "Hide filter" : "Preview filter"}</Button>
    </div>
    {expanded && result && (!result.available ? <p role="alert" className="text-sm text-destructive">{result.reason}</p> : signals && comparison && <>
      <div className="flex flex-col gap-3 sm:flex-row">
        <FilterSelect ariaLabel="Filter sensor channel" className="w-full sm:w-72" value={channel} onValueChange={setChannel}
          options={[{ value: "acceleration", label: "Acceleration including gravity" }, { value: "gyroscope", label: "Gyroscope" }]} />
        <FilterSelect ariaLabel="Experimental filter cutoff" className="w-full sm:w-44" value={String(cutoff)} onValueChange={value => setCutoff(Number(value) as FilterCutoff)}
          options={FILTER_CUTOFFS.map(value => ({ value: String(value), label: `${value} Hz cutoff` }))} />
      </div>
      <p className="text-xs text-muted-foreground">Experimental; excludes the first 0.5 s after each restart.</p>
      <SignalTimeline title={channel === "acceleration" ? "Acceleration · before / after" : "Gyroscope · before / after"} unit={unit} points={signals.before}
        comparison={{ points: signals.after, label: "After" }} domain={bounds} selection={selection} cursor={cursor} onCursor={onCursor} onSelection={onSelection}
        syncId={syncId} includeZero={false} headingLevel="h5" />
      <div className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h5 className="text-sm font-semibold">Selected interval · {seconds(selection[0])}–{seconds(selection[1])}</h5>
          <Button size="sm" variant="outline" disabled={selection[0] === bounds[0] && selection[1] === bounds[1]} onClick={() => onSelection([...bounds])}>Select whole window</Button>
        </div>
        <DetailsList items={[["Compared / warm-up / missing rows", `${comparison.paired} / ${comparison.warmup} / ${comparison.missing}`]]} />
        {comparison.paired === 0 ? <p className="text-xs text-muted-foreground">No values after warm-up.</p> : <Table>
          <caption className="pb-2 text-left text-xs text-muted-foreground">Values: before / after</caption>
          <TableHeader><TableRow><TableHead>Axis</TableHead><TableHead>Std. deviation ({unit})</TableHead><TableHead>Peak |axis| ({unit})</TableHead><TableHead>Peak-time difference (ms)</TableHead></TableRow></TableHeader>
          <TableBody>{comparison.axes.map(axis => <TableRow key={axis.axis}>
            <TableCell className="font-medium">{axis.axis.toUpperCase()}</TableCell>
            <TableCell className="tabular-nums">{axis.before!.std.toFixed(5)} / {axis.after!.std.toFixed(5)}</TableCell>
            <TableCell className="tabular-nums">{axis.before!.peak.toFixed(5)} / {axis.after!.peak.toFixed(5)}</TableCell>
            <TableCell className="tabular-nums">{axis.peakTimeDifferenceMs === null ? "Unavailable" : axis.peakTimeDifferenceMs.toFixed(0)}</TableCell>
          </TableRow>)}</TableBody>
        </Table>}
        {comparison.paired > 0 && <p className="text-xs text-muted-foreground">Peak times may describe different movements, so their difference is not event delay.</p>}
      </div>
      <details className="text-xs"><summary className="min-h-8 cursor-pointer font-medium text-primary">Filter details</summary>
        <div className="mt-3 space-y-3"><DetailsList items={[
          ["Method", FILTER_VERSION], ["Grid / cutoff", `50 Hz / ${cutoff} Hz`], ["Warm-up per segment", `${FILTER_WARMUP_MS} ms`],
          ["Channel segments", String(signals.segments)], ["Numerator b", result.coefficients.b.map(value => value.toFixed(9)).join(" / ")],
          ["Denominator a", result.coefficients.a.map(value => value.toFixed(9)).join(" / ")],
        ]} />
        <p className="leading-relaxed text-muted-foreground">Causal second-order Butterworth: starts from the first valid reading and restarts each channel after gaps.</p>
        <p className="leading-relaxed text-muted-foreground">Comparisons use matching rows after warm-up; gaps stay missing and gravity stays included.</p>
        <p className="leading-relaxed text-muted-foreground">Unsaved preview; lower variation does not prove noise removal.</p>
        </div>
      </details>
    </>)}
  </section>;
}
