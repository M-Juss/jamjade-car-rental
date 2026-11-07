"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, Clock3, Database, Info, Radio, RotateCcw, ZoomIn } from "lucide-react";
import { ManagementPageHeading } from "@/modules/management/shell/components/ManagementPageHeading";
import { KpiCard } from "@/components/common/data-display/KpiCard";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatReturnDateTime } from "@/services/booking/return-time";
import { getResearchInspection } from "@/services/research/research.service";
import type { ResearchInspection } from "@/services/research/types";
import { annotationTime, intervalStats, nearestPoint, seconds, signalPoints } from "./recording-analysis";
import { ResearchState } from "./components/ResearchState";
import { DetailsList, ObserverDetails, RecordingQuality, RecordingSetup } from "./components/RecordingDetails";
import { SignalTimeline } from "./components/SignalTimeline";

export function RecordingReviewModule({ trialId }: { trialId: string }) {
  const [inspection, setInspection] = useState<ResearchInspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getResearchInspection(trialId, controller.signal).then((data) => {
      if (!controller.signal.aborted) { setInspection(data); setError(null); }
    }).catch((cause) => { if (!controller.signal.aborted) setError(cause); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [trialId, revision]);

  return <section className="space-y-5 p-4 sm:p-6 lg:p-8">
    <Button asChild variant="ghost" size="sm"><Link href="/admin/research"><ArrowLeft className="size-4" />Recordings</Link></Button>
    {loading || error || !inspection ? <><ManagementPageHeading title="Recording review" description="Inspect measurements and observer labels for a recorded trial." /><ResearchState loading={loading} error={error} onRetry={() => { setLoading(true); setRevision((value) => value + 1); }} /></> : <RecordingWorkspace key={inspection.trial.id} inspection={inspection} />}
  </section>;
}

function RecordingWorkspace({ inspection }: { inspection: ResearchInspection }) {
  const { trial, samples } = inspection;
  const linear = useMemo(() => signalPoints(samples, "linear"), [samples]);
  const includingGravity = useMemo(() => signalPoints(samples, "including_gravity"), [samples]);
  const rotation = useMemo(() => signalPoints(samples, "rotation"), [samples]);
  const duration = Math.max(trial.summary.duration_ms, linear.at(-1)?.time ?? 0, includingGravity.at(-1)?.time ?? 0, rotation.at(-1)?.time ?? 0);
  const observed: [number, number] = [annotationTime(samples, trial.event_start_ms), annotationTime(samples, trial.event_end_ms)];
  const [selection, setSelection] = useState<[number, number]>([0, duration]);
  const [view, setView] = useState<[number, number]>([0, duration]);
  const [cursor, setCursor] = useState(0);
  const [acceleration, setAcceleration] = useState<"linear" | "including_gravity">("linear");
  const [tab, setTab] = useState("signals");
  const accelerationPoints = acceleration === "linear" ? linear : includingGravity;
  const stats = useMemo(() => intervalStats(accelerationPoints, ...selection), [accelerationPoints, selection]);
  const rotationStats = useMemo(() => intervalStats(rotation, ...selection), [rotation, selection]);
  const currentAcceleration = nearestPoint(accelerationPoints, cursor);
  const currentRotation = nearestPoint(rotation, cursor);
  const metrics = [
    { label: "Duration (s)", value: (trial.summary.duration_ms / 1000).toFixed(2), icon: Clock3 },
    { label: "Saved samples", value: samples.length.toLocaleString(), icon: Database },
    { label: "Acceleration rate (Hz)", value: trial.summary.mean_rate_hz.toFixed(1), icon: Radio },
    { label: "Largest gap (ms)", value: trial.summary.max_gap_ms.toFixed(0), icon: Activity },
  ];

  function inspectObserved() {
    setSelection([Math.max(0, observed[0]), Math.min(duration, observed[1])]);
    setCursor(Math.max(0, observed[0])); setTab("signals");
  }

  return <>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <ManagementPageHeading title="Recording review" description="Inspect measurements and observer labels for a recorded trial." />
      <div className="flex flex-wrap gap-2"><Badge variant="outline">Protocol v{inspection.protocol.version}</Badge>{trial.session.app_version === "synthetic-demo" && <Badge className="border-warning-border bg-warning-surface text-warning" variant="outline">Demo data</Badge>}</div>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><p className="font-semibold">{trial.session.name}</p><p className="text-xs text-muted-foreground">{formatReturnDateTime(trial.started_at)}</p></div>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{metrics.map((metric) => <KpiCard key={metric.label} {...metric} />)}</div>
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <Card className="min-w-0 rounded-2xl border border-border bg-surface shadow-none ring-0">
        <Tabs value={tab} onValueChange={setTab}>
          <CardHeader className="gap-3 border-b border-border">
            <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-base font-semibold">Understand this recording</CardTitle><Badge variant="secondary">Phone axes</Badge></div>
            <TabsList className="w-full justify-start"><TabsTrigger value="signals" className="flex-1">Signals</TabsTrigger><TabsTrigger value="quality" className="flex-1">Data quality</TabsTrigger><TabsTrigger value="setup" className="flex-1">Setup & source</TabsTrigger></TabsList>
          </CardHeader>
          <TabsContent value="signals" className="mt-0">
            <CardContent className="space-y-5 pt-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><FilterSelect ariaLabel="Acceleration signal" value={acceleration} onValueChange={setAcceleration} className="sm:w-60" options={[
                { value: "linear", label: "Linear acceleration" }, { value: "including_gravity", label: "Including gravity" },
              ]} /><span className="text-xs text-muted-foreground">Unfiltered saved values</span></div>
              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" />Vehicle alignment is not recorded. X, Y, and Z describe the phone, not forward, lateral, and vertical vehicle motion.</p>
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">View: {seconds(view[0])}–{seconds(view[1])}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={selection[1] - selection[0] < 1} onClick={() => setView(selection)}><ZoomIn className="size-3.5" />Zoom to interval</Button>{(view[0] !== 0 || view[1] !== duration) && <Button variant="ghost" size="sm" onClick={() => setView([0, duration])}>Full recording</Button>}</div></div>
              <SignalTimeline title={acceleration === "linear" ? "Linear acceleration" : "Acceleration including gravity"} unit={inspection.units.acceleration} points={accelerationPoints} domain={view} selection={selection} observed={observed} cursor={cursor} onCursor={setCursor} onSelection={setSelection} syncId={trial.id} />
              <SignalTimeline title="Rotation rate" unit={inspection.units.rotation} points={rotation} domain={view} selection={selection} observed={observed} cursor={cursor} onCursor={setCursor} onSelection={setSelection} syncId={trial.id} />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-2"><span className="h-3 w-5 rounded-sm border border-primary/30 bg-primary/10" />Shaded: saved observer interval</span><span>Drag a range or use the controls below.</span></div>
              <div className="rounded-xl border border-border bg-background p-4">
                <label htmlFor="recording-cursor" className="flex items-center justify-between gap-2 text-xs font-medium"><span>Inspect a moment</span><span className="tabular-nums">{seconds(cursor)}</span></label>
                <input id="recording-cursor" type="range" min={0} max={duration} step={1} value={cursor} onChange={(event) => setCursor(Number(event.target.value))} className="h-11 w-full cursor-pointer accent-primary" />
                <div className="grid gap-3 sm:grid-cols-2"><MomentValues title="Acceleration" point={currentAcceleration} unit={inspection.units.acceleration} /><MomentValues title="Rotation" point={currentRotation} unit={inspection.units.rotation} /></div>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">Graphs use saved sensor timestamps on a shared relative timeline. Gaps above 250 ms stay broken. V1 combines the latest channel readings; it does not contain independent raw Android streams or a cleaned signal.</p>
            </CardContent>
          </TabsContent>
          <TabsContent value="quality" className="mt-0"><CardContent className="pt-4"><RecordingQuality inspection={inspection} /></CardContent></TabsContent>
          <TabsContent value="setup" className="mt-0"><CardContent className="pt-4"><RecordingSetup inspection={inspection} /></CardContent></TabsContent>
        </Tabs>
      </Card>
      <aside className="min-w-0 space-y-5" aria-label="Interval inspection and observer annotation">
        <Card className="rounded-2xl border border-border bg-surface shadow-none ring-0"><CardHeader><CardTitle className="flex items-center justify-between text-sm font-semibold">Inspect an interval<Button variant="ghost" size="icon" aria-label="Reset interval to full recording" onClick={() => setSelection([0, duration])}><RotateCcw className="size-4" /></Button></CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-muted px-3 py-2 text-center text-sm font-semibold tabular-nums">{seconds(selection[0])} <span className="font-normal text-muted-foreground">to</span> {seconds(selection[1])}</div>
            {(["Start", "End"] as const).map((label, index) => <div key={label}><label htmlFor={`interval-${label}`} className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="tabular-nums">{seconds(selection[index])}</span></label><input id={`interval-${label}`} type="range" min={0} max={duration} step={1} value={selection[index]} onChange={(event) => {
              const value = Number(event.target.value);
              setSelection(index === 0 ? [Math.min(value, selection[1]), selection[1]] : [selection[0], Math.max(value, selection[0])]);
            }} className="h-11 w-full cursor-pointer accent-primary" /></div>)}
            <DetailsList items={[
              ["Interval duration", seconds(selection[1] - selection[0])], ["Acceleration points", stats?.count.toLocaleString() ?? "0"],
              ["Peak magnitude", stats ? `${stats.peak.toFixed(3)} ${inspection.units.acceleration}` : "No measurements"],
              ["RMS magnitude", stats ? `${stats.rms.toFixed(3)} ${inspection.units.acceleration}` : "No measurements"],
              ["Peak rotation magnitude", rotationStats ? `${rotationStats.peak.toFixed(3)} ${inspection.units.rotation}` : "No measurements"],
            ]} />
            {stats && <div className="border-t border-border pt-3"><p className="mb-2 text-xs text-muted-foreground">Mean acceleration ({inspection.units.acceleration})</p><div className="grid grid-cols-3 gap-2 text-center">{stats.mean.map((value, index) => <div key={index} className="rounded-lg bg-background p-2"><p className="text-xs text-muted-foreground">{["X", "Y", "Z"][index]}</p><p className="mt-1 text-xs font-semibold tabular-nums">{value.toFixed(3)}</p></div>)}</div></div>}
            <p className="text-xs leading-relaxed text-muted-foreground">{acceleration === "linear" ? "Linear acceleration" : "Acceleration including gravity"}. Magnitude combines all three phone axes. These values do not assign a harsh label.</p>
          </CardContent>
        </Card>
        <ObserverDetails inspection={inspection} onInspect={inspectObserved} />
      </aside>
    </div>
  </>;
}

function MomentValues({ title, point, unit }: { title: string; point: ReturnType<typeof nearestPoint>; unit: string }) {
  return <div><div className="mb-1 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground"><p>{title} ({unit})</p>{point ? <p>At {seconds(point.time)}</p> : null}</div>{point ? <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium tabular-nums">{(["x", "y", "z"] as const).map((axis) => <span key={axis}>{axis.toUpperCase()} {point[axis]?.toFixed(3)}</span>)}</p> : <p className="text-xs text-muted-foreground">No nearby measurement</p>}</div>;
}
