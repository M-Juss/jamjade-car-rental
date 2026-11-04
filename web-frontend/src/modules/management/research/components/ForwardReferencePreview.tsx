"use client";

import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ProcessingRunForm } from "@/forms/research/ProcessingRunForm";
import type { ProcessingDetail } from "@/services/research/processing-types";
import type { NativeEvent } from "@/services/research/native-types";
import { forwardReferencePreview, FORWARD_PREVIEW_VERSION, type ForwardRanges, type ReferenceRange } from "../forward-reference";
import { nativeSignalPoints } from "../native-analysis";
import { seconds } from "../recording-analysis";
import { suggestForwardIntervals, SUGGESTION_VERSION } from "../reference-suggestions";
import { DetailsList } from "./RecordingDetails";
import { SignalTimeline } from "./SignalTimeline";
import { SignalSelectionControls } from "./SignalSelectionControls";

const roles = [{ key: "rest", label: "Resting" }, { key: "starting", label: "Starting" }, { key: "stopping", label: "Stopping" }] as const;
const rangeText = (range: ReferenceRange) => `${seconds(range[0])}–${seconds(range[1])}`;
const vector = (v: number[]) => v.map(value => value.toFixed(5)).join(" / ");

export function ForwardReferencePreview({ recordingId, acceleration, gyroscope, origin, bounds, onSaved }: {
  recordingId: string; acceleration: NativeEvent[]; gyroscope: NativeEvent[]; origin: string;
  bounds: ReferenceRange; onSaved: (result: ProcessingDetail) => void;
}) {
  const id = useId();
  const [suggestion] = useState(() => suggestForwardIntervals(acceleration, gyroscope, origin, bounds));
  const [ranges, setRanges] = useState<Partial<ForwardRanges>>(() => suggestion.available ? suggestion.ranges : {});
  const [adjusted, setAdjusted] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [selection, setSelection] = useState<ReferenceRange>(bounds);
  const [cursor, setCursor] = useState(bounds[0]);
  const points = useMemo(() => nativeSignalPoints(acceleration, origin), [acceleration, origin]);
  const complete = Boolean(ranges.rest && ranges.starting && ranges.stopping);
  const preview = useMemo(() => confirmed && ranges.rest && ranges.starting && ranges.stopping
    ? forwardReferencePreview(acceleration, gyroscope, origin, { rest: ranges.rest, starting: ranges.starting, stopping: ranges.stopping }, bounds) : null,
  [confirmed, ranges, acceleration, gyroscope, origin, bounds]);
  const notes = [...new Set([...(suggestion.available && !adjusted ? suggestion.notes : []), ...(preview?.available ? preview.warnings : [])])];
  const assign = (role: keyof ForwardRanges) => {
    setRanges(current => ({ ...current, [role]: [...selection] as ReferenceRange }));
    setAdjusted(true); setConfirmed(false);
  };
  return <section className="space-y-5" aria-labelledby={`${id}-title`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id={`${id}-title`} className="text-sm font-semibold">Reference intervals</h3>
      {suggestion.available && adjusted && <Button size="sm" variant="ghost" onClick={() => {
        setRanges(suggestion.ranges); setAdjusted(false); setConfirmed(false);
      }}>Restore suggestions</Button>}
    </div>
    {!suggestion.available && <p className="text-xs text-muted-foreground">{suggestion.reason}</p>}
    <div className="grid gap-3 sm:grid-cols-3">
      {roles.map(role => <div key={role.key} className="space-y-2 rounded-xl border border-border p-3">
        <h4 className="text-xs font-semibold">{role.label}</h4>
        <p className="text-xs tabular-nums text-muted-foreground">{ranges[role.key] ? rangeText(ranges[role.key]!) : "Not selected"}</p>
        <Button size="sm" variant="outline" disabled={!ranges[role.key]} onClick={() => setSelection([...ranges[role.key]!])}
          aria-label={`Show ${role.label.toLowerCase()} interval in chart`}>Inspect</Button>
      </div>)}
    </div>
    <SignalTimeline title="Original acceleration" unit="m/s²" points={points} domain={bounds} selection={selection} cursor={cursor}
      onCursor={setCursor} onSelection={setSelection} syncId={`${recordingId}-preparation`} includeZero={false} initialAxes={["x", "y"]} />
    <details className="text-xs"><summary className="min-h-9 cursor-pointer font-medium text-primary">Adjust intervals</summary>
      <div className="mt-3 space-y-3">
        <SignalSelectionControls bounds={bounds} selection={selection} onSelection={setSelection} />
        <div className="flex flex-wrap gap-2">{roles.map(role => <Button key={role.key} size="sm" variant="outline" onClick={() => assign(role.key)}>Use selection for {role.label.toLowerCase()}</Button>)}</div>
      </div>
    </details>
    {notes.length > 0 && <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">{notes.map(note => <li key={note}>{note}</li>)}</ul>}
    <div className="space-y-3 border-t border-border pt-4">
      <label htmlFor={`${id}-confirm`} className="flex min-h-11 cursor-pointer items-center gap-3 text-xs font-medium has-disabled:opacity-60">
        <Checkbox id={`${id}-confirm`} checked={confirmed} disabled={!complete} onCheckedChange={value => setConfirmed(value === true)} />
        <span className="min-w-0 leading-5">RC rested, started forward and stopped; phone stayed fixed.</span>
      </label>
      {preview && !preview.available && <p role="alert" className="text-sm text-destructive">{preview.reason}</p>}
      {preview?.available && ranges.rest && ranges.starting && ranges.stopping && <>
        <ProcessingRunForm key={JSON.stringify(ranges)} recordingId={recordingId} onSaved={onSaved}
          defaults={{ start_ms: bounds[0], end_ms: bounds[1], cutoff_hz: 5, confirmed: true, ranges: { rest: ranges.rest, starting: ranges.starting, stopping: ranges.stopping } }} />
        <details className="text-xs"><summary className="min-h-9 cursor-pointer font-medium text-primary">Reference diagnostics</summary>
          <div className="mt-3 space-y-4">
            <DetailsList items={[["Angle from phone top", `${preview.angleFromPhoneTop.toFixed(2)}°`], ["Start variance share", `${(preview.varianceShare * 100).toFixed(1)}%`],
              ["Start / opposite-stop difference", preview.stopOppositionDegrees === null ? "Unavailable" : `${preview.stopOppositionDegrees.toFixed(2)}°`]]} />
            {preview.phases.map(phase => <div key={phase.phase} className="space-y-3">
              <h4 className="font-semibold">{roles.find(role => role.key === phase.phase)!.label}</h4>
              <DetailsList items={[["Acceleration / gyro readings", `${phase.acceleration.count} / ${phase.gyroscope.count}`],
                ["Largest gaps (ms)", `${phase.acceleration.largestGapMs.toFixed(2)} / ${phase.gyroscope.largestGapMs.toFixed(2)}`],
                ["Acceleration edge gaps (ms)", `${phase.acceleration.leadingGapMs.toFixed(2)} / ${phase.acceleration.trailingGapMs.toFixed(2)}`],
                ["Gyro edge gaps (ms)", `${phase.gyroscope.leadingGapMs.toFixed(2)} / ${phase.gyroscope.trailingGapMs.toFixed(2)}`],
                ["Acceleration std XYZ (m/s²)", vector(phase.acceleration.std)],
                ["Forward / right mean (m/s²)", `${phase.forwardMean.toFixed(4)} / ${phase.rightMean.toFixed(4)}`], ["Up-axis rotation RMS (rad/s)", phase.upRotationRms.toFixed(5)]]} />
            </div>)}
            <DetailsList items={preview.rotationRfu.map((row, index) => [["Right row", "Forward row", "Up row"][index], vector(row)])} />
            <p className="leading-relaxed text-muted-foreground">{FORWARD_PREVIEW_VERSION}: fixed resting frame from original channels. Variance share does not measure accuracy.</p>
            {suggestion.available && !adjusted && <DetailsList items={[["Automatic selection", SUGGESTION_VERSION], ["Quiet after stopping", suggestion.quietAfter ? rangeText(suggestion.quietAfter) : "Not found"],
              ["Acceleration variation limit (m/s²)", suggestion.diagnostics.accelLimit.toFixed(6)], ["Gyro RMS limit (rad/s)", suggestion.diagnostics.gyroLimit.toFixed(6)],
              ["Forward mean limit (m/s²)", suggestion.diagnostics.levelLimit.toFixed(6)]]} />}
          </div>
        </details>
      </>}
    </div>
  </section>;
}
