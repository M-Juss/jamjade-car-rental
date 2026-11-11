"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ApiError } from "@/services/http";
import { getManeuverSignal, type ComparisonRecording, type Maneuver, type PreparedSample, type ReviewedManeuver } from "@/services/research/maneuver-comparison.service";

const channels = {
  rotation: { index: 6, label: "Yaw rate · rad/s" },
  lateral: { index: 2, label: "Lateral acceleration · m/s²" },
  longitudinal: { index: 1, label: "Longitudinal acceleration · m/s²" },
} as const;
type Channel = keyof typeof channels;
const chartConfig = { normal: { label: "Normal", color: "var(--primary)" }, harsh: { label: "Harsh", color: "var(--warning)" } };
const eventId = (event: ReviewedManeuver) => `${event.annotation_id}/${event.index}`;

function usePreparedSignal(event: ReviewedManeuver | undefined) {
  const [result, setResult] = useState<{ event: ReviewedManeuver; samples: PreparedSample[]; error?: string }>();
  useEffect(() => {
    if (!event) return;
    const controller = new AbortController();
    getManeuverSignal(event, controller.signal).then(response => {
      if (!controller.signal.aborted) setResult({ event, samples: response.data.samples });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ event, samples: [], error: error instanceof ApiError && error.status === 409
        ? "The selected interval changed. Refresh the comparison."
        : "Prepared signals could not load. Select the interval again or refresh." });
    });
    return () => controller.abort();
  }, [event]);

  const current = result?.event === event ? result : undefined;
  return { samples: current?.samples ?? [], loading: Boolean(event && !current), error: current?.error };
}

export function ManeuverSignalComparison({ maneuver, events, recordings }: {
  maneuver: Maneuver; events: ReviewedManeuver[]; recordings: Map<string, ComparisonRecording>;
}) {
  const [normalId, setNormalId] = useState("");
  const [harshId, setHarshId] = useState("");
  const [channel, setChannel] = useState<Channel>(maneuver === "cornering" || maneuver === "swerving" ? "rotation" : "longitudinal");
  const measured = events.filter(event => event.measurements !== null).toSorted((a, b) =>
    (recordings.get(a.recording_id)?.name ?? "").localeCompare(recordings.get(b.recording_id)?.name ?? "", undefined, { numeric: true }) || a.start_ms - b.start_ms);
  const options = (severity: ReviewedManeuver["severity"]) => measured.filter(event => event.severity === severity).map(event => ({
    value: eventId(event), label: `${recordings.get(event.recording_id)?.name ?? "Recording"} · ${event.start_ms / 1000}–${event.end_ms / 1000} s`,
  }));
  const normal = usePreparedSignal(measured.find(event => eventId(event) === normalId));
  const harsh = usePreparedSignal(measured.find(event => eventId(event) === harshId));
  const normalOptions = options("normal");
  const harshOptions = options("harsh");
  const series = new Map<number, { time: number; normal?: number; harsh?: number }>();
  for (const [severity, samples] of [["normal", normal.samples], ["harsh", harsh.samples]] as const) {
    for (const sample of samples) {
      const time = sample[0];
      const point = series.get(time) ?? { time };
      point[severity] = sample[channels[channel].index];
      series.set(time, point);
    }
  }
  const chartRows = [...series.values()].sort((a, b) => a.time - b.time);

  return <Card>
    <CardHeader><CardTitle><h2>Compare recordings</h2></CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="min-w-0 space-y-1.5">
          <span className="font-medium">Normal recording</span>
          <FilterSelect ariaLabel="Normal recording" value={normalId} onValueChange={setNormalId} options={normalOptions}
            placeholder={normalOptions.length ? "Select a recording" : "No prepared signals"} disabled={!normalOptions.length} />
        </div>
        <div className="min-w-0 space-y-1.5">
          <span className="font-medium">Harsh recording</span>
          <FilterSelect ariaLabel="Harsh recording" value={harshId} onValueChange={setHarshId} options={harshOptions}
            placeholder={harshOptions.length ? "Select a recording" : "No prepared signals"} disabled={!harshOptions.length} />
        </div>
        <div className="min-w-0 space-y-1.5">
          <span className="font-medium">Signal</span>
          <FilterSelect ariaLabel="Signal" value={channel} onValueChange={setChannel}
            options={Object.entries(channels).map(([value, details]) => ({ value, label: details.label }))} />
        </div>
      </div>
      {(normal.loading || harsh.loading) && <p role="status" className="text-muted-foreground">Loading prepared signals…</p>}
      {(normal.error || harsh.error) && <p role="alert" className="text-destructive">{normal.error ?? harsh.error}</p>}
      {chartRows.length > 0 ? <>
        <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full sm:h-80" aria-label={`${channels[channel].label} from selected recordings`}>
          <LineChart accessibilityLayer data={chartRows} margin={{ top: 8, left: -10, right: 12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="time" type="number" domain={[0, "dataMax"]} tickFormatter={value => `${Number(value.toFixed(2))} s`} tickLine={false} axisLine={false} />
            <YAxis domain={["auto", "auto"]} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={value => `${Number(value).toFixed(3)} s`} />} />
            <ChartLegend content={<ChartLegendContent />} />
            {normal.samples.length > 0 && <Line dataKey="normal" stroke="var(--color-normal)" strokeWidth={2} dot={normal.samples.length === 1} connectNulls isAnimationActive={false} />}
            {harsh.samples.length > 0 && <Line dataKey="harsh" stroke="var(--color-harsh)" strokeWidth={2} strokeDasharray="5 3" dot={harsh.samples.length === 1} connectNulls isAnimationActive={false} />}
          </LineChart>
        </ChartContainer>
        <p className="text-xs text-muted-foreground">Time from the start of each reviewed interval.</p>
      </> : !normalId && !harshId && (normalOptions.length > 0 || harshOptions.length > 0) &&
        <p className="text-muted-foreground">Choose a recording to see its prepared signal.</p>}
    </CardContent>
  </Card>;
}
