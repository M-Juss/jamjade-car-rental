import type { ReactNode } from "react";
import { CheckCircle2, CircleAlert, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ResearchInspection } from "@/services/research/types";
import { humanize, maneuverLabel, seconds } from "../recording-analysis";

export function DetailsList({ items }: { items: [label: string, value: ReactNode, help?: ReactNode][] }) {
  return <dl className="space-y-3 text-xs">{items.map(([label, value, help]) => <div key={label} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
    <dt className="inline-flex items-center gap-1 text-muted-foreground">{label}{help && <Popover>
      <PopoverTrigger asChild><Button type="button" variant="ghost" size="icon-xs" aria-label={`About ${label.toLowerCase()}`}><Info className="size-3.5" aria-hidden="true" /></Button></PopoverTrigger>
      <PopoverContent align="start" aria-label={`About ${label.toLowerCase()}`} className="space-y-3 text-xs leading-relaxed">
        <p className="font-semibold">{label}</p>{help}
      </PopoverContent>
    </Popover>}</dt>
    <dd className="max-w-full break-words text-right font-medium">{value}</dd>
  </div>)}</dl>;
}

export function ObserverDetails({ inspection, onInspect }: { inspection: ResearchInspection; onInspect: () => void }) {
  const { trial } = inspection;
  return <Card className="rounded-2xl border border-border bg-surface shadow-none ring-0">
    <CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">Observer annotation<Badge variant={trial.label_status === "confirmed" ? "secondary" : "outline"}>{humanize(trial.label_status)}</Badge></CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <div className="border-l-2 border-primary pl-3"><p className="text-sm font-semibold">{maneuverLabel(trial.observed_movement, trial.observed_intensity)}</p><button type="button" onClick={onInspect} className="mt-1 min-h-8 text-xs font-medium text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary">Inspect saved event · {seconds(trial.event_start_ms)}–{seconds(trial.event_end_ms)}</button></div>
      <DetailsList items={[["Intended", maneuverLabel(trial.intended_movement, trial.intended_intensity)], ["Observer quality", humanize(trial.quality)]]} />
      {trial.notes && <p className="whitespace-pre-wrap break-words rounded-xl bg-background p-3 text-xs leading-relaxed">{trial.notes}</p>}
      <p className="text-xs leading-relaxed text-muted-foreground">Saved with the recording. Inspection ranges do not change this annotation.</p>
    </CardContent>
  </Card>;
}

export function RecordingQuality({ inspection }: { inspection: ResearchInspection }) {
  const { trial } = inspection;
  const flags = trial.summary.quality_flags;
  const checks = [
    { label: "Original file", text: "Integrity verified", okay: true },
    { label: "Capture checks", text: flags.length ? flags.map(humanize).join(", ") : "No v1 timing flags", okay: !flags.length },
    { label: "Observer quality", text: humanize(trial.quality), okay: trial.quality === "usable" },
    { label: "Observer label", text: humanize(trial.label_status), okay: trial.label_status === "confirmed" },
  ];
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2">{checks.map((check) => {
      const Icon = check.okay ? CheckCircle2 : CircleAlert;
      return <div key={check.label} className="flex items-start gap-3 rounded-xl border border-border p-4"><Icon className={`mt-0.5 size-4 shrink-0 ${check.okay ? "text-success" : "text-warning"}`} /><div><p className="text-xs text-muted-foreground">{check.label}</p><p className="mt-1 text-sm font-medium">{check.text}</p></div></div>;
    })}</div>
    <DetailsList items={[
      ["Requested rate", `${(1000 / inspection.protocol.requested_interval_ms).toFixed(0)} Hz`],
      ["Delivered acceleration rate", `${trial.summary.mean_rate_hz.toFixed(2)} Hz`],
      ["Acceleration timestamp span", seconds(trial.summary.sensor_duration_ms)],
      ["Largest recorded gap", `${trial.summary.max_gap_ms.toFixed(1)} ms`],
      ["Maximum gravity-reference change", `${trial.summary.max_tilt_degrees.toFixed(2)}°`],
      ["Sensor range / clipping metadata", "Not recorded in v1"],
      ["Vehicle alignment reference", "Not recorded in v1"],
      ["Versioned cleaning", "Not available"],
    ]} />
    <div className="flex items-start gap-2 rounded-xl bg-background p-3 text-xs leading-relaxed text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" /><p>These are capture checks, not proof of training suitability. The v1 timing flags use 8 Hz, a 250 ms gap, and 85% timestamp-span coverage; they are not harsh-movement thresholds.</p></div>
  </div>;
}

export function RecordingSetup({ inspection }: { inspection: ResearchInspection }) {
  const { session } = inspection.trial;
  return <div className="space-y-5"><DetailsList items={[
    ["Session", session.name], ["Phone", session.phone_model ?? "Not recorded"], ["RC model", session.rc_model ?? "Not recorded"],
    ["Surface", session.surface], ["Slope", humanize(session.slope)], ["Mount position", humanize(session.mount_orientation)],
    ["Mount method", session.mount_method ?? "Not recorded"], ["Battery condition", humanize(session.battery_condition)],
    ["RC configuration", session.rc_configuration ?? "Not recorded"], ["Platform", humanize(session.platform)], ["App version", session.app_version],
  ]} /><div className="border-t border-border pt-4"><h3 className="mb-3 text-sm font-semibold">Recording source</h3><DetailsList items={[
    ["Capture", inspection.source === "synthetic_demo_v1" ? "Synthetic demo samples · v1 format" : "Expo DeviceMotion · foreground"], ["Protocol", `v${inspection.protocol.version} · ${inspection.protocol.recording_mode}`],
    ["Coordinates", "Phone axes"], ["Acceleration", inspection.units.acceleration], ["Rotation", inspection.units.rotation],
  ]} /><details className="mt-4 text-xs"><summary className="cursor-pointer font-medium text-primary">File integrity fingerprint</summary><p className="mt-2 break-all text-muted-foreground">SHA-256 · {inspection.content_sha256}</p></details></div></div>;
}
