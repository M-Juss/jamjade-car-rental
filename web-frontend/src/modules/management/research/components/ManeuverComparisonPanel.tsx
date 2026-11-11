"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/services/http";
import { getManeuverComparison, type ComparisonRecording, type Maneuver, type ManeuverComparison, type Measurement, type ReviewedManeuver, type Severity } from "@/services/research/maneuver-comparison.service";
import { ManeuverSignalComparison } from "./ManeuverSignalComparison";

const maneuvers = [
  { value: "cornering", label: "Cornering" }, { value: "swerving", label: "Swerving" }, { value: "acceleration", label: "Acceleration" }, { value: "braking", label: "Braking" },
];
const directions = {
  cornering: [{ value: "left", label: "Left" }, { value: "right", label: "Right" }],
  swerving: [{ value: "left", label: "Initial left" }, { value: "right", label: "Initial right" }, { value: "unknown", label: "Unknown" }],
  longitudinal: [{ value: "forward", label: "Forward" }, { value: "reverse", label: "Reverse" }],
};
const severities = ["normal", "harsh"] as const;
const chartConfig = { normal: { label: "Normal", color: "var(--primary)" }, harsh: { label: "Harsh", color: "var(--warning)" } };
const { format } = new Intl.NumberFormat("en", { maximumFractionDigits: 3 });
const formatDifference = (value: number) => `${value > 0 ? "+" : ""}${format(value)}`;
const surfaceLabel = (value: string) => value.replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase());

function measurementOptions(maneuver: Maneuver): { value: Measurement; label: string }[] {
  const duration = { value: "duration", label: maneuver === "cornering" ? "Turn duration · s" : "Duration · s" } as const;
  if (maneuver === "cornering" || maneuver === "swerving") return [
    { value: "peak_turn_rate", label: "Peak turn rate · rad/s" },
    { value: "peak_lateral_acceleration", label: "Peak lateral acceleration · m/s²" }, duration,
  ];
  return [{ value: "peak_longitudinal_acceleration", label: maneuver === "braking" ? "Peak deceleration · m/s²" : "Peak longitudinal acceleration · m/s²" }, duration];
}

function valuesFor(events: ReviewedManeuver[], severity: Severity, key: Measurement) {
  return events.flatMap(event => {
    const value = event.measurements?.[key];
    return event.severity === severity && value !== undefined ? [value] : [];
  });
}

function describe(values: number[]) {
  if (!values.length) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const middle = (sorted.length - 1) / 2;
  return { mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    median: (sorted[Math.floor(middle)] + sorted[Math.ceil(middle)]) / 2, min: sorted[0], max: sorted[sorted.length - 1] };
}

function histogram(normal: number[], harsh: number[]) {
  const values = [...normal, ...harsh];
  if (!values.length) return [];
  const min = values.reduce((low, value) => Math.min(low, value), Infinity);
  const max = values.reduce((high, value) => Math.max(high, value), -Infinity);
  const count = min === max ? 1 : Math.min(12, Math.ceil(Math.sqrt(values.length)));
  const width = (max - min) / count;
  const bins = Array.from({ length: count }, (_, index) => ({
    index,
    label: count === 1 ? (min === max ? format(min) : `${format(min)}–${format(max)}`)
      : `${format(min + index * width)}–${format(index === count - 1 ? max : min + (index + 1) * width)}`,
    normal: 0, harsh: 0,
  }));
  for (const [severity, series] of [["normal", normal], ["harsh", harsh]] as const) {
    for (const value of series) bins[width === 0 ? 0 : Math.min(count - 1, Math.floor((value - min) / width))][severity]++;
  }
  return bins;
}

function ComparisonFilter<T extends string>({ label, value, onChange, options }: {
  label: string; value: T; onChange: (value: T) => void; options: { value: string; label: string }[];
}) {
  return <div className="min-w-0 space-y-1.5">
    <span className="font-medium">{label}</span>
    <FilterSelect ariaLabel={label} value={value} onValueChange={onChange} options={options} />
  </div>;
}

export function ManeuverComparisonPanel() {
  const [comparison, setComparison] = useState<ManeuverComparison | null>(null);
  const [maneuver, setManeuver] = useState<Maneuver>("cornering");
  const [surface, setSurface] = useState("all");
  const [session, setSession] = useState("all");
  const [direction, setDirection] = useState("all");
  const [measurement, setMeasurement] = useState<Measurement>("peak_turn_rate");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function refresh() {
    setLoading(true);
    setError("");
    setRevision(value => value + 1);
  }

  useEffect(() => {
    const controller = new AbortController();
    getManeuverComparison(controller.signal).then(response => {
      if (!controller.signal.aborted) setComparison(response.data);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof ApiError && cause.status === 403
        ? "Model Explorer is unavailable for this account or research profile."
        : "Reviewed maneuvers could not load. Try again.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);

  const recordings = (comparison?.recordings ?? []).toSorted((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const byId = new Map(recordings.map(recording => [recording.id, recording]));
  const surfaces = [...new Set(recordings.map(recording => recording.surface))].sort();
  const sessions = new Map<string, ComparisonRecording>();
  for (const recording of recordings) {
    if (recording.session_id && !sessions.has(recording.session_id)) sessions.set(recording.session_id, recording);
  }
  const sessionOptions = [{ value: "all", label: "All sessions" }, ...[...sessions.entries()]
    .sort(([, a], [, b]) => (a.session_number ?? 0) - (b.session_number ?? 0)).map(([value, recording]) => ({
      value, label: `S${String(recording.session_number).padStart(2, "0")} (${surfaceLabel(recording.surface)})`,
    }))];
  if (recordings.some(recording => !recording.session_id)) sessionOptions.push({ value: "unassigned", label: "No session" });
  const activeSurface = surfaces.includes(surface) ? surface : "all";
  const activeSession = sessionOptions.some(option => option.value === session) ? session : "all";
  const events = (comparison?.events ?? []).filter(event => {
    const recording = byId.get(event.recording_id);
    return recording && event.maneuver === maneuver && (direction === "all" || event.direction === direction)
      && (activeSurface === "all" || recording.surface === activeSurface)
      && (activeSession === "all" || (recording.session_id ?? "unassigned") === activeSession);
  });
  const measurements = measurementOptions(maneuver);
  const bins = histogram(valuesFor(events, "normal", measurement), valuesFor(events, "harsh", measurement));
  const resultsSurfaces = [...new Set(events.map(event => byId.get(event.recording_id)!.surface))].sort();
  const normalCount = events.filter(event => event.severity === "normal").length;
  const harshCount = events.length - normalCount;

  return <div className="space-y-5">
    {loading ? <p role="status" className="text-muted-foreground">Loading reviewed maneuvers…</p> : error ? <div role="alert" className="space-y-3"><p className="text-destructive">{error}</p><Button variant="outline" onClick={refresh}>Try again</Button></div> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ComparisonFilter label="Surface" value={activeSurface} onChange={setSurface} options={[{ value: "all", label: "All surfaces" }, ...surfaces.map(value => ({ value, label: surfaceLabel(value) }))]} />
        <ComparisonFilter label="Session" value={activeSession} onChange={setSession} options={sessionOptions} />
        <ComparisonFilter label="Maneuver" value={maneuver} onChange={(value: Maneuver) => { setManeuver(value); setDirection("all"); setMeasurement(measurementOptions(value)[0].value); }} options={maneuvers} />
        <ComparisonFilter label={maneuver === "swerving" ? "Initial direction" : "Direction"} value={direction} onChange={setDirection} options={[{ value: "all", label: "All directions" }, ...directions[maneuver === "cornering" || maneuver === "swerving" ? maneuver : "longitudinal"]]} />
      </div>

      <Card>
        <CardHeader><CardTitle><h2>Normal vs Harsh</h2></CardTitle>
          <p className="text-sm text-muted-foreground">Measurements use complete prepared signals from intervals clear of contact.</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Measurement</TableHead><TableHead>Normal</TableHead><TableHead>Harsh</TableHead><TableHead>Difference</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell>Reviewed events</TableCell><TableCell>{normalCount}</TableCell><TableCell>{harshCount}</TableCell><TableCell>{formatDifference(harshCount - normalCount)}</TableCell></TableRow>
              {measurements.map(({ value, label }) => {
                const [normal, harsh] = severities.map(severity => describe(valuesFor(events, severity, value)));
                return <TableRow key={value}>
                  <TableCell>{label}<div className="text-xs text-muted-foreground">Mean · median · range</div></TableCell>
                  {[normal, harsh].map((stats, index) => <TableCell key={severities[index]} className="tabular-nums">{stats ? <>
                    <div className="font-medium">{format(stats.mean)}</div><div className="text-xs text-muted-foreground">{format(stats.median)} · {format(stats.min)}–{format(stats.max)}</div>
                  </> : "—"}</TableCell>)}
                  <TableCell className="tabular-nums">{normal && harsh ? formatDifference(harsh.mean - normal.mean) : "—"}</TableCell>
                </TableRow>;
              })}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">Difference is harsh minus normal. Measurement differences use the means.</p>
        </CardContent>
      </Card>

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
        <Card className="min-w-0"><CardHeader><CardTitle><h2>Measurement distribution</h2></CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <ComparisonFilter label="Measurement" value={measurement} onChange={setMeasurement} options={measurements} />
            {bins.length === 0 ? <p className="text-muted-foreground">No measurements for these filters.</p> :
              <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full" aria-label="Normal and harsh event counts by measured value">
                <BarChart accessibilityLayer data={bins} margin={{ top: 8, left: -15, right: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="index" tickFormatter={index => bins[index]?.label ?? ""} tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={label => bins[Number(label)]?.label ?? ""} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="normal" fill="var(--color-normal)" isAnimationActive={false} />
                  <Bar dataKey="harsh" fill="var(--color-harsh)" isAnimationActive={false} />
                </BarChart>
              </ChartContainer>}
          </CardContent>
        </Card>
        <Card className="min-w-0"><CardHeader><CardTitle><h2>Results by surface</h2></CardTitle>
          <p className="text-sm text-muted-foreground">{measurements.find(item => item.value === measurement)?.label}</p>
        </CardHeader><CardContent>
          {resultsSurfaces.length === 0 ? <p className="text-muted-foreground">No reviewed maneuvers for these filters.</p> : <Table>
            <TableHeader><TableRow><TableHead>Surface</TableHead><TableHead>Normal mean</TableHead><TableHead>Harsh mean</TableHead><TableHead>Difference</TableHead></TableRow></TableHeader>
            <TableBody>{resultsSurfaces.map(value => {
              const surfaceEvents = events.filter(event => byId.get(event.recording_id)?.surface === value);
              const [normal, harsh] = severities.map(severity => describe(valuesFor(surfaceEvents, severity, measurement)));
              return <TableRow key={value}><TableCell>{surfaceLabel(value)}</TableCell>
                <TableCell>{normal ? format(normal.mean) : "—"}</TableCell><TableCell>{harsh ? format(harsh.mean) : "—"}</TableCell>
                <TableCell>{normal && harsh ? formatDifference(harsh.mean - normal.mean) : "—"}</TableCell></TableRow>;
            })}</TableBody>
          </Table>}
        </CardContent></Card>
      </div>

      <ManeuverSignalComparison key={`${revision}/${maneuver}/${activeSurface}/${activeSession}/${direction}`} maneuver={maneuver} events={events} recordings={byId} />
    </>}
  </div>;
}
