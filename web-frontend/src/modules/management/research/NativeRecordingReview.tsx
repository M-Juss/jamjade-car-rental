"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Activity, ChevronLeft, Clock3, Database, Radio } from "lucide-react";
import { KpiCard } from "@/components/common/data-display/KpiCard";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getNativeInspection, getNativeWindow } from "@/services/research/native-research.service";
import type { NativeChannel, NativeInspection, NativeStatistics, NativeWindow } from "@/services/research/native-types";
import { formatReturnDateTime } from "@/services/booking/return-time";
import { ResearchState } from "./components/ResearchState";
import { DetailsList } from "./components/RecordingDetails";
import { SignalTimeline } from "./components/SignalTimeline";
import { SignalStatisticHelp } from "./components/SignalStatisticHelp";
import { StationaryReferencePreview } from "./components/StationaryReferencePreview";
import { ForwardReferencePreview } from "./components/ForwardReferencePreview";
import { SynchronizationPreview } from "./components/SynchronizationPreview";
import { humanize, seconds } from "./recording-analysis";
import { nativeIntervalStats, nativeSignalPoints } from "./native-analysis";

const channelLabels: Record<NativeChannel, string> = { accelerometer: "Accelerometer including gravity", gyroscope: "Gyroscope",
  gravity: "Android gravity estimate", linear_acceleration: "Android linear acceleration", rotation_vector: "Rotation vector (first 3 components)" };
const fixed = (value: number | null | undefined, digits = 2) => value == null ? "Unavailable" : value.toFixed(digits);

export function NativeRecordingReview({ id }: { id: string }) {
  const [inspection, setInspection] = useState<NativeInspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getNativeInspection(id, controller.signal).then(data => { if (!controller.signal.aborted) { setInspection(data); setError(null); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, revision]);
  return <section className="space-y-5 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <Link href="/admin/research" className="group -ml-1.5 flex shrink-0 items-center gap-1.5 rounded-md p-1.5 text-xs text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <ChevronLeft size={15} className="transition-transform group-hover:-translate-x-0.5" />Recordings
        </Link>
        {inspection && !error && <><span aria-hidden="true" className="text-border">/</span><h1 aria-current="page" className="min-w-0 break-words text-xs font-semibold text-foreground">{inspection.recording.name}</h1></>}
      </nav>
      {inspection && !error && <time dateTime={inspection.recording.started_at} className="text-xs text-muted-foreground">{formatReturnDateTime(inspection.recording.started_at)}</time>}
    </header>
    {loading || error || !inspection ? <ResearchState loading={loading} error={error} onRetry={() => { setLoading(true); setRevision(v => v + 1); }} /> : <NativeWorkspace key={inspection.recording.id} inspection={inspection} />}
  </section>;
}

function NativeWorkspace({ inspection }: { inspection: NativeInspection }) {
  const { recording: record, manifest } = inspection;
  const accel = record.summary?.accelerometer;
  const metrics = [
    { label: "Duration (s)", value: (record.duration_ms / 1000).toFixed(2), icon: Clock3 },
    { label: "Acceleration readings", value: accel?.event_count.toLocaleString() ?? "Pending", icon: Database },
    { label: "Acceleration rate (Hz)", value: fixed(accel?.rate_hz, 1), icon: Radio },
    { label: "Largest acceleration gap (ms)", value: fixed(accel?.max_gap_ms, 1), icon: Activity },
  ];
  return <>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{metrics.map(metric => <KpiCard key={metric.label} {...metric} />)}</div>
    <Card className="min-w-0 rounded-2xl border border-border bg-surface shadow-none ring-0"><Tabs defaultValue="signals">
      <CardHeader className="border-b border-border"><TabsList className="w-full justify-start"><TabsTrigger value="signals" className="flex-1">Signals</TabsTrigger><TabsTrigger value="quality" className="flex-1">Data quality</TabsTrigger><TabsTrigger value="setup" className="flex-1">Setup & source</TabsTrigger></TabsList></CardHeader>
      <TabsContent value="signals" className="mt-0"><CardContent className="pt-4">{record.state !== "verified" ? <p className="text-sm text-muted-foreground">{record.received_chunks}/{record.expected_chunks} chunks received. Retry upload from the phone to finish verification.</p>
        : record.duration_ms <= 0 ? <p className="text-sm text-muted-foreground">This recording has no inspectable time interval.</p> : <NativeSignals inspection={inspection} />}</CardContent></TabsContent>
      <TabsContent value="quality" className="mt-0"><CardContent className="space-y-5 pt-4">
        <DetailsList items={[["File integrity", record.state === "verified" ? "Verified" : "Incomplete"], ["Capture", humanize(record.capture_state)], ["Labels", "Unlabeled"]]} />
        {Object.entries(record.summary ?? {}).map(([channel, stats]) => <ChannelQuality key={channel} title={channelLabels[channel as NativeChannel]} stats={stats} />)}
      </CardContent></TabsContent>
      <TabsContent value="setup" className="mt-0"><CardContent className="space-y-5 pt-4"><DetailsList items={[
        ["Collection group", manifest.context.recording_group_name ?? "Not recorded"], ["Purpose", humanize(manifest.context.recording_kind)],
        ["Surface", manifest.context.surface], ["Slope", humanize(manifest.context.slope)], ["RC model", manifest.context.rc_model ?? "Not recorded"],
        ["Mount method", manifest.context.mount_method], ["Orientation", humanize(manifest.context.mount_orientation)], ["Phone", manifest.device?.model ?? "Not recorded"],
        ["Native adapter", manifest.device?.native_adapter_version ?? "Not recorded"], ["Source", "Android SensorManager"], ["Coordinates", "Android natural device axes"],
        ["Saved vehicle alignment", "None"], ["Processing", "Original values"],
      ]} /><details className="text-xs"><summary className="cursor-pointer font-medium text-primary">Original manifest fingerprint</summary><p className="mt-2 break-all text-muted-foreground">SHA-256 · {record.manifest_sha256}</p></details></CardContent></TabsContent>
    </Tabs></Card>
  </>;
}

function ChannelQuality({ title, stats }: { title: string; stats: NativeStatistics }) {
  return <div className="space-y-3 border-b border-border pb-4"><h3 className="text-sm font-semibold">{title}</h3><DetailsList items={[
    ["Saved readings", stats.event_count.toLocaleString()], ["Delivered rate (Hz)", fixed(stats.rate_hz)], ["Largest gap (ms)", fixed(stats.max_gap_ms)],
    ["Startup / trailing gap (ms)", `${fixed(stats.startup_gap_ms)} / ${fixed(stats.trailing_gap_ms)}`], ["Repeated / backward timestamps", `${stats.duplicate_timestamps} / ${stats.backwards_timestamps}`],
    ["Sequence gaps", String(stats.sequence_gaps)], ["Outside capture interval", String(stats.out_of_interval)],
  ]} /></div>;
}

function NativeSignals({ inspection }: { inspection: NativeInspection }) {
  const { recording: record, manifest } = inspection;
  const [channel, setChannel] = useState<NativeChannel>("accelerometer");
  const [start, setStart] = useState(0);
  const [windowSize, setWindowSize] = useState(30000);
  const end = Math.min(record.duration_ms, start + windowSize);
  const [windows, setWindows] = useState<NativeWindow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState<[number, number]>([start, end]);
  const [cursor, setCursor] = useState(start);
  const timeline = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError(null); setWindows(null); setSelection([start, end]); setCursor(start);
      const results = await Promise.allSettled([getNativeWindow(record.id, channel, start, end, controller.signal), getNativeWindow(record.id, "gyroscope", start, end, controller.signal)]);
      if (controller.signal.aborted) return;
      const failed = results.find(result => result.status === "rejected");
      if (failed?.status === "rejected") setError(failed.reason);
      else setWindows(results.flatMap(result => result.status === "fulfilled" ? [result.value] : []));
      setLoading(false);
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [record.id, channel, start, end, revision]);
  const points = useMemo(() => nativeSignalPoints(windows?.[0]?.events ?? [], manifest.started_elapsed_ns), [windows, manifest.started_elapsed_ns]);
  const gyro = useMemo(() => nativeSignalPoints(windows?.[1]?.events ?? [], manifest.started_elapsed_ns), [windows, manifest.started_elapsed_ns]);
  const stats = useMemo(() => nativeIntervalStats(points, ...selection), [points, selection]);
  const gyroStats = useMemo(() => nativeIntervalStats(gyro, ...selection), [gyro, selection]);
  const unit = channel === "rotation_vector" ? "unitless XYZ" : "m/s²";
  return <div className="space-y-5">
    <FilterSelect value={channel} onValueChange={setChannel} ariaLabel="Original sensor channel" className="w-full sm:w-80" options={(["accelerometer", "linear_acceleration", "gravity", "rotation_vector"] as NativeChannel[]).map(value => ({ value, label: channelLabels[value] }))} />
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{seconds(start)}–{seconds(end)} of {seconds(record.duration_ms)}</p><div className="flex flex-wrap gap-2">
      <FilterSelect ariaLabel="Signal window length" className="w-36" value={String(windowSize)} onValueChange={value => { setWindowSize(Number(value)); setStart(0); }} options={[{ value: "5000", label: "5 seconds" }, { value: "10000", label: "10 seconds" }, { value: "30000", label: "30 seconds" }]} />
      <Button size="sm" variant="outline" disabled={start <= 0 || loading} onClick={() => setStart(v => Math.max(0, v - windowSize))}>Previous</Button><Button size="sm" variant="outline" disabled={end >= record.duration_ms || loading} onClick={() => setStart(end)}>Next</Button></div></div>
    {loading || error ? <ResearchState loading={loading} error={error} onRetry={() => setRevision(v => v + 1)} /> : <>
      {!points.length && <p className="text-sm text-muted-foreground">No readings in this interval.</p>}
      <div ref={timeline} className="scroll-mt-4"><SignalTimeline title={channelLabels[channel]} unit={unit} points={points} domain={[start, end]} selection={selection} cursor={cursor} onCursor={setCursor} onSelection={setSelection} syncId={record.id} includeZero={false} /></div>
      <SignalTimeline title="Gyroscope" unit="rad/s" points={gyro} domain={[start, end]} selection={selection} cursor={cursor} onCursor={setCursor} onSelection={setSelection} syncId={record.id} includeZero={false} />
      <div className="grid gap-4 lg:grid-cols-2"><div className="space-y-3 rounded-xl border border-border p-4"><h3 className="text-sm font-semibold">Selected interval</h3>
        {(["Start", "End"] as const).map((label, index) => <div key={label}><label htmlFor={`native-${label}`} className="flex justify-between text-xs"><span>{label}</span><span>{seconds(selection[index])}</span></label><input id={`native-${label}`} type="range" className="h-11 w-full accent-primary" min={start} max={end} step={1} value={selection[index]} onChange={event => { const v = Number(event.target.value); setSelection(index === 0 ? [Math.min(v, selection[1]), selection[1]] : [selection[0], Math.max(v, selection[0])]); }} /></div>)}
        <DetailsList items={[
          ["Readings", String(stats?.count ?? 0)],
          ["Peak magnitude", stats ? `${fixed(stats.peak, 4)} ${unit}` : "Unavailable", <SignalStatisticHelp key="peak" kind="peak" channel={channel} count={stats?.count ?? 0} />],
          ["RMS magnitude", stats ? `${fixed(stats.rms, 4)} ${unit}` : "Unavailable", <SignalStatisticHelp key="rms" kind="rms" channel={channel} count={stats?.count ?? 0} />],
          ["Gyroscope RMS", gyroStats ? `${fixed(gyroStats.rms, 4)} rad/s` : "Unavailable", <SignalStatisticHelp key="gyroscope" kind="gyroscope" channel="gyroscope" count={gyroStats?.count ?? 0} />],
        ]} />
      </div><div className="space-y-3 rounded-xl border border-border p-4"><h3 className="text-sm font-semibold">Axis statistics ({unit})</h3><DetailsList items={[
        ["Mean X / Y / Z", stats ? stats.mean.map(v => v.toFixed(4)).join(" / ") : "Unavailable"],
        ["Std. deviation X / Y / Z", stats ? stats.std.map(v => v.toFixed(4)).join(" / ") : "Unavailable"],
        ["Gyroscope mean X / Y / Z (rad/s)", gyroStats ? gyroStats.mean.map(v => v.toFixed(5)).join(" / ") : "Unavailable"],
      ]} /></div></div>
      {channel === "accelerometer" && <SynchronizationPreview key={`sync:${start}:${end}`} acceleration={windows?.[0]?.events ?? []} gyroscope={windows?.[1]?.events ?? []}
        origin={manifest.started_elapsed_ns} bounds={[start, end]} selection={selection} cursor={cursor} onCursor={setCursor} onSelection={setSelection} syncId={record.id} />}
      {channel === "accelerometer" && (manifest.context.recording_kind === "forward_reference"
        ? <ForwardReferencePreview key={`${start}:${end}`} acceleration={windows?.[0]?.events ?? []} gyroscope={windows?.[1]?.events ?? []} origin={manifest.started_elapsed_ns} selection={selection} bounds={[start, end]}
          cursor={cursor} onCursor={setCursor} onSelection={setSelection} syncId={record.id}
          onInspect={range => { setSelection(range); timeline.current?.scrollIntoView({ block: "start", behavior: "instant" }); }} />
        : <StationaryReferencePreview key={`${selection[0]}:${selection[1]}`} acceleration={windows?.[0]?.events ?? []} gyroscope={windows?.[1]?.events ?? []} origin={manifest.started_elapsed_ns} selection={selection} />)}
    </>}
    <details className="text-xs"><summary className="min-h-8 cursor-pointer font-medium text-primary">Signal details</summary>
      <div className="mt-3"><DetailsList items={[
        ["Axes", "Original phone XYZ"], ["Time basis", "Independent sensor timestamps"], ["Filtering / interpolation", "None"],
        ["Line breaks", "Gaps > 250 ms; repeated/backward times"],
        ...(channel === "rotation_vector" ? [["Rotation vector", "XYZ shown; all components retained"] as [string, string]] : []),
      ]} /></div>
    </details>
  </div>;
}
