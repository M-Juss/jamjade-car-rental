"use client";

import { useMemo, useState } from "react";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { Button } from "@/components/ui/button";
import type { NativeEvent } from "@/services/research/native-types";
import type { ForwardReferenceCandidate, ReferenceRange } from "../forward-reference";
import { seconds } from "../recording-analysis";
import { vehicleAxisPreview, vehicleAxisIntervalStats, VEHICLE_PREVIEW_VERSION } from "../vehicle-axis-preview";
import { DetailsList } from "./RecordingDetails";
import { SignalTimeline } from "./SignalTimeline";

const labels = { x: "Forward", y: "Right", z: "Up" };
const vector = (values: number[]) => values.map(value => value.toFixed(4)).join(" / ");

export function VehicleAxisPreview({ acceleration, gyroscope, origin, bounds, reference, selection, cursor, onCursor, onSelection, syncId }: {
  acceleration: NativeEvent[]; gyroscope: NativeEvent[]; origin: string;
  bounds: ReferenceRange; reference: ForwardReferenceCandidate; selection: ReferenceRange; cursor: number;
  onCursor: (time: number) => void; onSelection: (range: ReferenceRange) => void; syncId: string;
}) {
  const [start, end] = bounds;
  const [relative, setRelative] = useState(true);
  const result = useMemo(() => vehicleAxisPreview(acceleration, gyroscope, origin, [start, end], reference),
    [acceleration, gyroscope, origin, start, end, reference]);
  const points = result.available ? relative ? result.relativeToRest : result.includingGravity : [];
  const stats = vehicleAxisIntervalStats(points, result.available ? result.rotation : [], selection);
  return <section className="space-y-4 border-t border-border pt-5" aria-label="Vehicle-axis preview">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-semibold">Vehicle axes · preview</h4>
      {result.available && <FilterSelect ariaLabel="Vehicle acceleration view" className="w-full sm:w-56" value={relative ? "relative" : "gravity"}
        onValueChange={value => setRelative(value === "relative")}
        options={[{ value: "relative", label: "Relative to resting mean" }, { value: "gravity", label: "Including gravity" }]} />}
    </div>
    {!result.available ? <p role="alert" className="text-sm text-destructive">{result.reason}</p> : <>
      <p className="text-xs text-muted-foreground">Tilt changes can still affect these readings.</p>
      <SignalTimeline title={relative ? "Acceleration relative to rest" : "Acceleration including gravity"} unit="m/s²" points={points}
        domain={bounds} selection={selection} cursor={cursor} onCursor={onCursor} onSelection={onSelection} syncId={syncId} axisLabels={labels} frameLabel="Vehicle" headingLevel="h5" />
      <SignalTimeline title="Rotation · resting offset removed" unit="rad/s" points={result.rotation}
        domain={bounds} selection={selection} cursor={cursor} onCursor={onCursor} onSelection={onSelection} syncId={syncId} axisLabels={labels} frameLabel="Vehicle" headingLevel="h5" />
      <div className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h5 className="text-sm font-semibold">Selected interval · {seconds(selection[0])}–{seconds(selection[1])}</h5>
          <Button size="sm" variant="outline" disabled={selection[0] === start && selection[1] === end} onClick={() => onSelection([start, end])}>Select whole window</Button>
        </div>
        <DetailsList items={[
          ["Acceleration / rotation readings", `${stats.acceleration?.count ?? 0} / ${stats.rotation?.count ?? 0}`],
          ["Mean forward / right / up (m/s²)", stats.acceleration ? vector(stats.acceleration.mean) : "Unavailable"],
          ["Std. deviation forward / right / up (m/s²)", stats.acceleration ? vector(stats.acceleration.std) : "Unavailable"],
          ["Up-axis rotation RMS (rad/s)", stats.upRotationRms === null ? "Unavailable" : stats.upRotationRms.toFixed(5)],
        ]} />
      </div>
      <details className="text-xs">
        <summary className="min-h-8 cursor-pointer font-medium text-primary">Window timing and projection</summary>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">{([['Acceleration', result.accelerationTiming], ['Gyroscope', result.gyroscopeTiming]] as const).map(([label, timing]) => <div key={label} className="space-y-3">
          <h5 className="font-semibold">{label}</h5>
          <DetailsList items={[
            ["Original readings", String(timing.count)], ["Largest gap (ms)", timing.largestGapMs.toFixed(2)],
            ["Leading / trailing gap (ms)", `${timing.leadingGapMs.toFixed(2)} / ${timing.trailingGapMs.toFixed(2)}`],
          ]} />
        </div>)}</div>
        <p className="mt-3 leading-relaxed text-muted-foreground">{VEHICLE_PREVIEW_VERSION}: the candidate RFU matrix rotates each original event independently. The rest-relative view subtracts the fixed resting acceleration mean before rotation; gyro subtracts its resting mean. Source timestamps stay independent. No interpolation, dynamic gravity correction, filtering or saved calibration. Gaps above 250 ms break lines.</p>
        <p className="mt-3 leading-relaxed text-muted-foreground">Positive directions: Forward toward the RC front, Right toward its right, Up upward.</p>
      </details>
    </>}
  </section>;
}
