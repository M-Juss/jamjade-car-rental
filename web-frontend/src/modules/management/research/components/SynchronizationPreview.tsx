"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { NativeEvent } from "@/services/research/native-types";
import type { ReferenceRange } from "../forward-reference";
import { seconds } from "../recording-analysis";
import { GRID_STEP_MS, MAX_INTERPOLATION_MS, synchronizationCounts, synchronizationPreview, SYNCHRONIZATION_VERSION, type SynchronizedValue } from "../synchronization-preview";
import { DetailsList } from "./RecordingDetails";
import { SignalTimeline } from "./SignalTimeline";
import { FilterPreview } from "./FilterPreview";

const stateLabel = { original: "Original", interpolated: "Interpolated", gap: "Missing · long gap", outside: "Missing · window edge" };
const values = (value: SynchronizedValue) => value.values ? value.values.map(number => number.toFixed(5)).join(" / ") : "Missing";
const sourceTimes = (value: SynchronizedValue, origin: string) => {
  if (!value.sourceTimesNs) return "Unavailable";
  const start = BigInt(origin);
  const [before, after] = value.sourceTimesNs.map(time => `${(Number(BigInt(time) - start) / 1e9).toFixed(6)} s`);
  return <span className="flex flex-col items-end gap-1 tabular-nums">
    {value.state === "original" ? <span>Exact {before}</span> : <><span>Before {before}</span><span>After {after}</span></>}
  </span>;
};

export function SynchronizationPreview({ acceleration, gyroscope, origin, bounds, selection, cursor, onCursor, onSelection, syncId }: {
  acceleration: NativeEvent[]; gyroscope: NativeEvent[]; origin: string; bounds: ReferenceRange; selection: ReferenceRange;
  cursor: number; onCursor: (time: number) => void; onSelection: (range: ReferenceRange) => void; syncId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [start, end] = bounds;
  const result = useMemo(() => expanded ? synchronizationPreview(acceleration, gyroscope, origin, [start, end]) : null,
    [expanded, acceleration, gyroscope, origin, start, end]);
  const selected = result?.available ? result.rows.filter(row => row.time >= selection[0] && row.time <= selection[1]) : [];
  const counts = synchronizationCounts(selected);
  const row = result?.available ? result.rows[Math.max(0, Math.min(result.rows.length - 1, Math.round((cursor - result.rows[0].time) / GRID_STEP_MS)))] : null;
  return <section className="space-y-4 border-t border-border pt-5" aria-label="Time synchronization preview">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">Time synchronization · preview</h3>
      <Button size="sm" variant="outline" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "Hide synchronization" : "Preview synchronization"}</Button>
    </div>
    {expanded && result && (!result.available ? <p role="alert" className="text-sm text-destructive">{result.reason}</p> : <>
      <div className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">Selected interval · {seconds(selection[0])}–{seconds(selection[1])}</h4>
          <Button size="sm" variant="outline" disabled={selection[0] === start && selection[1] === end} onClick={() => onSelection([start, end])}>Select whole window</Button>
        </div>
        <DetailsList items={[
          ["Grid", `50 Hz · ${GRID_STEP_MS} ms`], ["Paired / total rows", `${counts.paired} / ${counts.rows}`],
          ["Acceleration counts", `${counts.acceleration.original} original · ${counts.acceleration.interpolated} interpolated · ${counts.acceleration.gap + counts.acceleration.outside} missing`],
          ["Gyroscope counts", `${counts.gyroscope.original} original · ${counts.gyroscope.interpolated} interpolated · ${counts.gyroscope.gap + counts.gyroscope.outside} missing`],
        ]} />
      </div>
      {result.counts.paired === 0 && <p className="text-xs text-muted-foreground">No paired rows; check timing in Data quality.</p>}
      <SignalTimeline title="Synchronized acceleration including gravity" unit="m/s²" points={result.acceleration} domain={bounds} selection={selection}
        cursor={cursor} onCursor={onCursor} onSelection={onSelection} syncId={syncId} includeZero={false} headingLevel="h4" />
      <SignalTimeline title="Synchronized gyroscope" unit="rad/s" points={result.gyroscope} domain={bounds} selection={selection}
        cursor={cursor} onCursor={onCursor} onSelection={onSelection} syncId={syncId} includeZero={false} headingLevel="h4" />
      {row && <div className="space-y-3 rounded-xl border border-border p-4">
        <h4 className="text-sm font-semibold">Grid row · {seconds(row.time)}</h4>
        <DetailsList items={[
          ["Acceleration source", stateLabel[row.acceleration.state]], ["Acceleration XYZ (m/s²)", values(row.acceleration)],
          ["Gyroscope source", stateLabel[row.gyroscope.state]], ["Gyroscope XYZ (rad/s)", values(row.gyroscope)],
        ]} />
      </div>}
      <details className="text-xs"><summary className="min-h-8 cursor-pointer font-medium text-primary">Synchronization details</summary>
        <div className="mt-3 space-y-3"><DetailsList items={[
          ["Method", SYNCHRONIZATION_VERSION], ["Source readings · accel / gyro", `${result.sourceCounts.acceleration} / ${result.sourceCounts.gyroscope}`],
          ["Window paired / total rows", `${result.counts.paired} / ${result.counts.rows}`], ["Interpolation limit", `${MAX_INTERPOLATION_MS} ms`],
          ["Edge missing · accel / gyro", `${result.counts.acceleration.outside} / ${result.counts.gyroscope.outside}`],
          ["Gap missing · accel / gyro", `${result.counts.acceleration.gap} / ${result.counts.gyroscope.gap}`],
        ]} />
        {row && <div className="space-y-3">
          <h4 className="font-semibold">Time since recording start</h4>
          <DetailsList items={[
            ["Grid time", seconds(row.time)],
            ["Acceleration source times", sourceTimes(row.acceleration, origin)],
            ["Acceleration bracket (ms)", row.acceleration.bracketMs?.toFixed(3) ?? "Unavailable"],
            ["Gyroscope source times", sourceTimes(row.gyroscope, origin)],
            ["Gyroscope bracket (ms)", row.gyroscope.bracketMs?.toFixed(3) ?? "Unavailable"],
          ]} />
        </div>}
        <p className="leading-relaxed text-muted-foreground">Linear interpolation fills grid times between readings ≤60 ms apart; gaps and window edges stay missing.</p>
        <p className="leading-relaxed text-muted-foreground">Only exact timestamp matches count as original, so zero originals can be normal.</p>
        <p className="leading-relaxed text-muted-foreground">Unsaved window preview; phone axes and gravity are unchanged.</p>
        </div>
      </details>
      <FilterPreview acceleration={result.acceleration} gyroscope={result.gyroscope} bounds={bounds} selection={selection} cursor={cursor}
        onCursor={onCursor} onSelection={onSelection} syncId={syncId} />
    </>)}
  </section>;
}
