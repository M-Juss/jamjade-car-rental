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
          ["Grid", `50 Hz · ${GRID_STEP_MS} ms`], ["Paired rows", `${counts.paired} / ${counts.rows}`],
          ["Acceleration · original / interpolated / missing", `${counts.acceleration.original} / ${counts.acceleration.interpolated} / ${counts.acceleration.gap + counts.acceleration.outside}`],
          ["Gyroscope · original / interpolated / missing", `${counts.gyroscope.original} / ${counts.gyroscope.interpolated} / ${counts.gyroscope.gap + counts.gyroscope.outside}`],
        ]} />
      </div>
      {result.counts.paired === 0 && <p className="text-xs text-muted-foreground">No paired rows in this window. Review source timing in Data quality.</p>}
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
          ["Method", SYNCHRONIZATION_VERSION], ["Source acceleration / gyro readings", `${result.sourceCounts.acceleration} / ${result.sourceCounts.gyroscope}`],
          ["Window paired / total rows", `${result.counts.paired} / ${result.counts.rows}`], ["Maximum interpolation span", `${MAX_INTERPOLATION_MS} ms`],
          ["Window-edge missing · acceleration / gyro", `${result.counts.acceleration.outside} / ${result.counts.gyroscope.outside}`],
          ["Long-gap missing · acceleration / gyro", `${result.counts.acceleration.gap} / ${result.counts.gyroscope.gap}`],
        ]} />
        {row && <DetailsList items={[
          ["Grid sensor time (ns)", row.sensorTimestampNs],
          ["Acceleration source times (ns)", row.acceleration.sourceTimesNs?.join(" / ") ?? "Unavailable"],
          ["Acceleration bracket (ms)", row.acceleration.bracketMs?.toFixed(3) ?? "Unavailable"],
          ["Gyroscope source times (ns)", row.gyroscope.sourceTimesNs?.join(" / ") ?? "Unavailable"],
          ["Gyroscope bracket (ms)", row.gyroscope.bracketMs?.toFixed(3) ?? "Unavailable"],
        ]} />}
        <p className="leading-relaxed text-muted-foreground">Experimental 50 Hz grid anchored to recording start. Linear interpolation requires two source readings at most 60 ms apart; no extrapolation. Original values require an exact timestamp match, so zero exact matches can be normal. Missing values stay missing. Phone axes and gravity are unchanged; no noise filter, calibration or training approval. Preview is unsaved and uses only this loaded window.</p>
        </div>
      </details>
      <FilterPreview acceleration={result.acceleration} gyroscope={result.gyroscope} bounds={bounds} selection={selection} cursor={cursor}
        onCursor={onCursor} onSelection={onSelection} syncId={syncId} />
    </>)}
  </section>;
}
