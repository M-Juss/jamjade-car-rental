"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { NativeEvent } from "@/services/research/native-types";
import { forwardReferencePreview, FORWARD_PREVIEW_VERSION, type ForwardRanges, type ReferenceRange } from "../forward-reference";
import { seconds } from "../recording-analysis";
import { DetailsList } from "./RecordingDetails";
import { suggestForwardIntervals, SUGGESTION_VERSION } from "../reference-suggestions";
import { VehicleAxisPreview } from "./VehicleAxisPreview";

const roles = [{ key: "rest", label: "Resting" }, { key: "starting", label: "Starting" }, { key: "stopping", label: "Stopping" }] as const;
const rangeText = (range: ReferenceRange) => `${seconds(range[0])}–${seconds(range[1])}`;
const vector = (v: number[]) => v.map(value => value.toFixed(5)).join(" / ");

export function ForwardReferencePreview({ acceleration, gyroscope, origin, selection, bounds, onInspect, cursor, onCursor, onSelection, syncId }: {
  acceleration: NativeEvent[]; gyroscope: NativeEvent[]; origin: string;
  selection: ReferenceRange; bounds: ReferenceRange; onInspect: (range: ReferenceRange) => void;
  cursor: number; onCursor: (time: number) => void; onSelection: (range: ReferenceRange) => void; syncId: string;
}) {
  const id = useId();
  const [suggestion] = useState(() => suggestForwardIntervals(acceleration, gyroscope, origin, bounds));
  const [ranges, setRanges] = useState<Partial<ForwardRanges>>(() => suggestion.available ? suggestion.ranges : {});
  const [adjusted, setAdjusted] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState<ReturnType<typeof forwardReferencePreview> | null>(null);
  const complete = ranges.rest && ranges.starting && ranges.stopping;
  const assign = (role: keyof ForwardRanges) => {
    setRanges(current => ({ ...current, [role]: [...selection] as ReferenceRange }));
    setAdjusted(true); setConfirmed(false); setPreview(null);
  };
  return <section className="space-y-4 border-t border-border pt-5" aria-labelledby={`${id}-title`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id={`${id}-title`} className="text-sm font-semibold">Forward reference · preview</h3>
      <p className="text-xs text-muted-foreground">Selected: {rangeText(selection)}</p>
    </div>
    <div className="space-y-2">
      {!suggestion.available && <p className="text-xs leading-relaxed text-muted-foreground">{suggestion.reason}</p>}
      {suggestion.available && !adjusted && suggestion.notes.map(note => <p key={note} className="text-xs leading-relaxed text-muted-foreground">{note}</p>)}
      {suggestion.available && adjusted && <Button size="sm" variant="ghost" onClick={() => {
        setRanges(suggestion.ranges); setAdjusted(false); setConfirmed(false); setPreview(null);
      }}>Restore suggestions</Button>}
    </div>
    <div className="grid gap-3 lg:grid-cols-3">
      {roles.map(role => <div key={role.key} className="space-y-3 rounded-xl border border-border p-4">
        <h4 className="text-sm font-semibold">{role.label}</h4>
        <p className="text-xs tabular-nums text-muted-foreground">{ranges[role.key] ? rangeText(ranges[role.key]!) : "Not selected"}</p>
        <div className="flex flex-wrap gap-2">
          {ranges[role.key] && <Button size="sm" variant="outline" onClick={() => onInspect(ranges[role.key]!)} aria-label={`Show ${role.label.toLowerCase()} interval in chart`}>Show in chart</Button>}
          <Button size="sm" variant={ranges[role.key] ? "ghost" : "outline"} onClick={() => assign(role.key)} aria-label={`Use selection as ${role.label.toLowerCase()} interval`}>Use selection</Button>
        </div>
      </div>)}
    </div>
    <label htmlFor={`${id}-confirm`} className="flex min-h-11 cursor-pointer items-center gap-3 text-xs font-medium has-disabled:opacity-60">
      <Checkbox id={`${id}-confirm`} checked={confirmed} disabled={!complete} onCheckedChange={value => { setConfirmed(value === true); setPreview(null); }} />
      <span className="min-w-0 leading-5">RC rested, started forward and stopped; phone stayed fixed.</span>
    </label>
    <Button size="sm" variant="outline" disabled={!complete || !confirmed} onClick={() => {
      if (ranges.rest && ranges.starting && ranges.stopping) setPreview(forwardReferencePreview(acceleration, gyroscope, origin,
        { rest: ranges.rest, starting: ranges.starting, stopping: ranges.stopping }, bounds));
    }}>Preview forward axis</Button>
    <div>
      <p role="status" className="sr-only">{preview?.available ? "Forward-reference preview ready." : ""}</p>
      {preview && !preview.available && <p role="alert" className="text-sm text-destructive">{preview.reason}</p>}
      {preview?.available && <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-border p-4">
            <h4 className="text-sm font-semibold">Candidate direction</h4>
            <DetailsList items={[
              ["Angle from phone top", `${preview.angleFromPhoneTop.toFixed(2)}°`],
              ["Start variance share", `${(preview.varianceShare * 100).toFixed(1)}%`],
              ["Start / opposite-stop difference", preview.stopOppositionDegrees === null ? "Unavailable" : `${preview.stopOppositionDegrees.toFixed(2)}°`],
            ]} />
          </div>
          <div className="space-y-3 rounded-xl border border-border p-4">
            <h4 className="text-sm font-semibold">Start and stop comparison</h4>
            {preview.phases.filter(phase => phase.phase !== "rest").map(phase => <div key={phase.phase} className="space-y-2">
              <h5 className="text-xs font-semibold">{phase.phase === "starting" ? "Starting" : "Stopping"}</h5>
              <DetailsList items={[
                ["Forward / right mean (m/s²)", `${phase.forwardMean.toFixed(4)} / ${phase.rightMean.toFixed(4)}`],
                ["Up-axis rotation RMS (rad/s)", phase.upRotationRms.toFixed(5)],
              ]} />
            </div>)}
          </div>
        </div>
        {preview.warnings.length > 0 && <div className="space-y-2"><h4 className="text-xs font-semibold">Review notes</h4><ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">{preview.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div>}
        <details className="text-xs">
          <summary className="min-h-8 cursor-pointer font-medium text-primary">Timing, matrix and method</summary>
          <div className="mt-3 grid gap-4 lg:grid-cols-3">{preview.phases.map(phase => <div key={phase.phase} className="space-y-3">
            <h4 className="font-semibold">{roles.find(role => role.key === phase.phase)!.label}</h4>
            <DetailsList items={[
              ["Acceleration / gyro readings", `${phase.acceleration.count} / ${phase.gyroscope.count}`],
              ["Observed spans (s)", `${(phase.acceleration.spanMs / 1000).toFixed(3)} / ${(phase.gyroscope.spanMs / 1000).toFixed(3)}`],
              ["Largest gaps (ms)", `${phase.acceleration.largestGapMs.toFixed(2)} / ${phase.gyroscope.largestGapMs.toFixed(2)}`],
              ["Acceleration edge gaps (ms)", `${phase.acceleration.leadingGapMs.toFixed(2)} / ${phase.acceleration.trailingGapMs.toFixed(2)}`],
              ["Gyro edge gaps (ms)", `${phase.gyroscope.leadingGapMs.toFixed(2)} / ${phase.gyroscope.trailingGapMs.toFixed(2)}`],
              ["Acceleration std XYZ (m/s²)", vector(phase.acceleration.std)],
            ]} />
          </div>)}</div>
          <div className="mt-4 space-y-3"><h4 className="font-semibold">Phone XYZ → right / forward / up</h4>
            <DetailsList items={preview.rotationRfu.map((row, index) => [["Right row", "Forward row", "Up row"][index], vector(row)])} />
          </div>
          {suggestion.available && !adjusted && <div className="mt-4 space-y-3"><h4 className="font-semibold">Automatic selection · {SUGGESTION_VERSION}</h4>
            <DetailsList items={[
              ["Quiet after stopping", suggestion.quietAfter ? rangeText(suggestion.quietAfter) : "Not found"],
              ["Analysis bin (ms)", String(suggestion.diagnostics.binMs)],
              ["Acceleration variation limit (m/s²)", suggestion.diagnostics.accelLimit.toFixed(6)],
              ["Gyro RMS limit (rad/s)", suggestion.diagnostics.gyroLimit.toFixed(6)],
              ["Forward mean limit (m/s²)", suggestion.diagnostics.levelLimit.toFixed(6)],
            ]} />
            <p className="leading-relaxed text-muted-foreground">Search limits do not confirm stillness or harsh events.</p>
          </div>}
          <p className="mt-3 leading-relaxed text-muted-foreground">{FORWARD_PREVIEW_VERSION}: resting acceleration estimates up; horizontal PCA estimates forward from the confirmed start.</p>
          <p className="mt-3 leading-relaxed text-muted-foreground">Gyro readings use that fixed up axis after resting-offset removal, without interpolation or smoothing.</p>
          <p className="mt-3 leading-relaxed text-muted-foreground">Requires ≥0.5 s per interval and a solvable axis; review timing and signal quality.</p>
          <p className="mt-3 leading-relaxed text-muted-foreground">Unsaved estimate; small steering corrections are allowed, but variance share does not measure confidence or accuracy.</p>
        </details>
        <VehicleAxisPreview acceleration={acceleration} gyroscope={gyroscope} origin={origin} bounds={bounds} reference={preview}
          selection={selection} cursor={cursor} onCursor={onCursor} onSelection={onSelection} syncId={syncId} />
      </div>}
    </div>
  </section>;
}
