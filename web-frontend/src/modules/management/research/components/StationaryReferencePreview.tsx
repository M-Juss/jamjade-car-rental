"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { NativeEvent } from "@/services/research/native-types";
import { seconds } from "../recording-analysis";
import { stationaryReferencePreview, STATIONARY_PREVIEW_VERSION } from "../stationary-reference";
import { DetailsList } from "./RecordingDetails";

const vector = (values: number[], digits = 4) => values.map(value => value.toFixed(digits)).join(" / ");

export function StationaryReferencePreview({ acceleration, gyroscope, origin, selection }: {
  acceleration: NativeEvent[]; gyroscope: NativeEvent[]; origin: string; selection: [number, number];
}) {
  const id = useId();
  const [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState<ReturnType<typeof stationaryReferencePreview> | null>(null);
  return <section className="space-y-4 border-t border-border pt-5" aria-labelledby={`${id}-title`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id={`${id}-title`} className="text-sm font-semibold">Stationary reference · preview</h3>
      <p className="text-xs text-muted-foreground">{seconds(selection[0])}–{seconds(selection[1])}</p>
    </div>
    <label htmlFor={`${id}-confirmed`} className="flex min-h-11 cursor-pointer items-center gap-3 text-xs font-medium">
      <Checkbox id={`${id}-confirmed`} checked={confirmed} onCheckedChange={value => { setConfirmed(value === true); setPreview(null); }} />
      <span className="min-w-0 leading-5">RC stayed still and phone stayed fixed throughout the selection.</span>
    </label>
    <Button type="button" size="sm" variant="outline" disabled={!confirmed} onClick={() => setPreview(stationaryReferencePreview(acceleration, gyroscope, origin, ...selection))}>Preview reference</Button>
    <div aria-live="polite">
      {preview && !preview.available && <p className="text-sm text-destructive" role="alert">{preview.reason}</p>}
      {preview?.available && <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-border p-4">
            <h4 className="text-sm font-semibold">Gravity estimate</h4>
            <DetailsList items={[
              ["Resting acceleration XYZ (m/s²)", vector(preview.acceleration.mean)],
              ["Magnitude (m/s²)", preview.magnitude.toFixed(4)],
              ["Estimated up · unit XYZ", vector(preview.upUnit, 5)],
              ["Variation · std XYZ (m/s²)", vector(preview.acceleration.std)],
              ["First / second half direction change", preview.directionChangeDegrees === null ? "Unavailable" : `${preview.directionChangeDegrees.toFixed(3)}°`],
            ]} />
          </div>
          <div className="space-y-3 rounded-xl border border-border p-4">
            <h4 className="text-sm font-semibold">Gyroscope resting offset</h4>
            <DetailsList items={[
              ["Estimated offset XYZ (rad/s)", vector(preview.gyroscope.mean, 6)],
              ["Variation · std XYZ (rad/s)", vector(preview.gyroscope.std, 6)],
            ]} />
          </div>
        </div>
        <details className="text-xs">
          <summary className="min-h-8 cursor-pointer font-medium text-primary">Timing and calculation</summary>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {([['Accelerometer', preview.acceleration], ['Gyroscope', preview.gyroscope]] as const).map(([label, stats]) => <div key={label} className="space-y-3">
              <h4 className="font-semibold">{label}</h4>
              <DetailsList items={[
                ["Readings", stats.count.toLocaleString()], ["Observed span", seconds(stats.spanMs)],
                ["Largest gap (ms)", stats.largestGapMs.toFixed(2)],
                ["Leading / trailing gap (ms)", `${stats.leadingGapMs.toFixed(2)} / ${stats.trailingGapMs.toFixed(2)}`],
              ]} />
            </div>)}
          </div>
          <p className="mt-3 leading-relaxed text-muted-foreground">{STATIONARY_PREVIEW_VERSION}: arithmetic means and population standard deviations, independently per channel. Five seconds is a preview minimum, not proof of stillness. Gaps remain unfilled; coverage and variation require review.</p>
          <p className="mt-3 leading-relaxed text-muted-foreground">Unsaved preview. Resting acceleration includes gravity and sensor bias. No automatic stillness, quality or forward-direction result.</p>
        </details>
      </div>}
    </div>
  </section>;
}
