"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, Clock3, Database, Radio } from "lucide-react";
import { KpiCard } from "@/components/common/data-display/KpiCard";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { ReuseReferenceForm } from "@/forms/research/ReuseReferenceForm";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getNativeInspection } from "@/services/research/native-research.service";
import type { NativeChannel, NativeInspection, NativeStatistics, NativeWindow } from "@/services/research/native-types";
import type { ProcessingDetail } from "@/services/research/processing-types";
import { formatReturnDateTime } from "@/services/booking/return-time";
import { ResearchState } from "./components/ResearchState";
import { DetailsList } from "./components/RecordingDetails";
import { SignalTimeline } from "./components/SignalTimeline";
import { SignalStatisticHelp } from "./components/SignalStatisticHelp";
import { StationaryReferencePreview } from "./components/StationaryReferencePreview";
import { ForwardReferencePreview } from "./components/ForwardReferencePreview";
import { ProcessingRuns } from "./components/ProcessingRuns";
import { NativeSignalWindow } from "./components/NativeSignalWindow";
import { SignalSelectionControls } from "./components/SignalSelectionControls";
import { NativeAnnotations } from "./components/NativeAnnotations";
import type { ReferenceRange } from "./forward-reference";
import { humanize, seconds } from "./recording-analysis";
import { nativeIntervalStats, nativeSignalPoints } from "./native-analysis";

const channelLabels: Record<NativeChannel, string> = { accelerometer: "Accelerometer including gravity", gyroscope: "Gyroscope",
  gravity: "Android gravity estimate", linear_acceleration: "Android linear acceleration", rotation_vector: "Rotation vector (first 3 components)" };
const fixed = (value: number | null | undefined, digits = 2) => value == null ? "Unavailable" : value.toFixed(digits);
const referenceChannels: NativeChannel[] = ["accelerometer", "gyroscope"];
// Reuse needs a bounded target window; its original streams are read by Laravel.
const boundsOnlyChannels: NativeChannel[] = [];

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
        {inspection && !error && <><span aria-hidden="true" className="text-border">/</span><h1 aria-current="page" className="min-w-0 break-words text-xs font-semibold text-foreground">{inspection.recording.display_code ?? inspection.recording.name}</h1></>}
      </nav>
      {inspection && !error && <time dateTime={inspection.recording.started_at} className="text-xs text-muted-foreground">{formatReturnDateTime(inspection.recording.started_at)}</time>}
    </header>
    {loading || error || !inspection ? <ResearchState loading={loading} error={error} onRetry={() => { setLoading(true); setRevision(v => v + 1); }} /> : <NativeWorkspace key={inspection.recording.id} inspection={inspection} />}
  </section>;
}

function NativeWorkspace({ inspection }: { inspection: NativeInspection }) {
  const { recording: record, manifest } = inspection;
  const [tab, setTab] = useState("signals");
  const [labelsOpened, setLabelsOpened] = useState(false);
  const [savedResult, setSavedResult] = useState<ProcessingDetail | null>(null);
  const [annotationState, setAnnotationState] = useState(record.annotation_state);
  const accel = record.summary?.accelerometer;
  const metrics = [
    { label: "Duration (s)", value: (record.duration_ms / 1000).toFixed(2), icon: Clock3 },
    { label: "Acceleration readings", value: accel?.event_count.toLocaleString() ?? "Pending", icon: Database },
    { label: "Acceleration rate (Hz)", value: fixed(accel?.rate_hz, 1), icon: Radio },
  ];
  return <>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{metrics.map(metric => <KpiCard key={metric.label} {...metric} />)}</div>
    <Card className="min-w-0 rounded-2xl border border-border bg-surface shadow-none ring-0"><Tabs value={tab} onValueChange={value => { setTab(value); if (value === "labels") setLabelsOpened(true); }}>
      <CardHeader className="border-b border-border"><TabsList className="grid w-full grid-cols-2 gap-1 group-data-horizontal/tabs:h-auto sm:grid-cols-5"><TabsTrigger value="signals" className="h-9">Signals</TabsTrigger><TabsTrigger value="prepare" className="h-9">Prepare data</TabsTrigger><TabsTrigger value="labels" className="h-9">Labels</TabsTrigger><TabsTrigger value="quality" className="h-9">Data quality</TabsTrigger><TabsTrigger value="setup" className="h-9">Setup & source</TabsTrigger></TabsList></CardHeader>
      <TabsContent value="signals" className="mt-0"><CardContent className="pt-4">{record.state !== "verified" ? <p className="text-sm text-muted-foreground">{record.received_chunks}/{record.expected_chunks} chunks received. Retry upload from the phone to finish verification.</p>
        : record.duration_ms <= 0 ? <p className="text-sm text-muted-foreground">This recording has no inspectable time interval.</p> : <NativeSignals inspection={inspection} initialResult={savedResult} />}</CardContent></TabsContent>
      <TabsContent value="prepare" className="mt-0"><CardContent className="pt-4">
        {record.state !== "verified" || record.duration_ms <= 0 ? <p className="text-sm text-muted-foreground">Finish uploading a recording with sensor readings before preparing data.</p>
          : <NativePreparation inspection={inspection} onSaved={result => { setSavedResult(result); setTab("signals"); }} />}
      </CardContent></TabsContent>
      {labelsOpened && <TabsContent value="labels" forceMount className="mt-0 data-[state=inactive]:hidden"><CardContent className="pt-4">
        {record.state !== "verified" || record.duration_ms <= 0 ? <p className="text-sm text-muted-foreground">Finish uploading before labeling intervals.</p>
          : <NativeAnnotations inspection={inspection} onState={setAnnotationState} />}
      </CardContent></TabsContent>}
      <TabsContent value="quality" className="mt-0"><CardContent className="space-y-5 pt-4">
        <DetailsList items={[["File integrity", record.state === "verified" ? "Verified" : "Incomplete"], ["Capture", humanize(record.capture_state)], ["Interval labels", humanize(annotationState)]]} />
        {Object.entries(record.summary ?? {}).map(([channel, stats]) => <ChannelQuality key={channel} title={channelLabels[channel as NativeChannel]} stats={stats} />)}
      </CardContent></TabsContent>
      <TabsContent value="setup" className="mt-0"><CardContent className="space-y-5 pt-4"><DetailsList items={[
        ["Collection group", manifest.context.recording_group_name ?? "Not recorded"], ["Purpose", humanize(manifest.context.recording_kind)],
        ["Surface", manifest.context.surface], ["Slope", humanize(manifest.context.slope)], ["RC model", manifest.context.rc_model ?? "Not recorded"],
        ["Mount method", manifest.context.mount_method], ["Orientation", humanize(manifest.context.mount_orientation)], ["Phone", manifest.device?.model ?? "Not recorded"],
        ["Native adapter", manifest.device?.native_adapter_version ?? "Not recorded"], ["Source", "Android SensorManager"], ["Coordinates", "Android natural device axes"],
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

function NativeSignals({ inspection, initialResult }: {
  inspection: NativeInspection; initialResult: ProcessingDetail | null;
}) {
  const supportsProcessing = ["forward_reference", "maneuver_trial"].includes(inspection.manifest.context.recording_kind);
  const [view, setView] = useState(supportsProcessing ? "processed" : "original");
  const viewControl = supportsProcessing ? <FilterSelect height="compact" value={view} onValueChange={setView} ariaLabel="Signal view" className="w-full sm:w-48"
    options={[{ value: "processed", label: "Processed readings" }, { value: "original", label: "Original readings" }]} /> : null;
  return <div className="space-y-4">
    {view === "processed" ? <ProcessingRuns recordingId={inspection.recording.id} initialResult={initialResult} viewControl={viewControl} />
      : <OriginalSignals inspection={inspection} viewControl={viewControl} />}
  </div>;
}

function OriginalSignals({ inspection, viewControl }: { inspection: NativeInspection; viewControl: ReactNode }) {
  const [channel, setChannel] = useState<NativeChannel>("accelerometer");
  const channels = useMemo(() => [channel], [channel]);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      {viewControl}
      <FilterSelect height="compact" value={channel} onValueChange={setChannel} ariaLabel="Original sensor channel" className="w-full sm:w-80"
        options={(["accelerometer", "gyroscope", "linear_acceleration", "gravity", "rotation_vector"] as NativeChannel[]).map(value => ({ value, label: channelLabels[value] }))} />
    </div>
    <NativeSignalWindow record={inspection.recording} channels={channels}>
      {(windows, bounds) => <OriginalSignalChart window={windows[0]} origin={inspection.manifest.started_elapsed_ns} bounds={bounds} recordingId={inspection.recording.id} />}
    </NativeSignalWindow>
  </div>;
}

function OriginalSignalChart({ window, origin, bounds, recordingId }: {
  window: NativeWindow; origin: string; bounds: ReferenceRange; recordingId: string;
}) {
  const [selection, setSelection] = useState<ReferenceRange>(bounds);
  const [cursor, setCursor] = useState(bounds[0]);
  const points = useMemo(() => nativeSignalPoints(window.events, origin), [window.events, origin]);
  const stats = nativeIntervalStats(points, ...selection);
  const unit = window.channel === "gyroscope" ? "rad/s" : window.channel === "rotation_vector" ? "unitless XYZ" : "m/s²";
  return <div className="space-y-4">
    {points.length === 0 ? <p className="text-sm text-muted-foreground">No readings for this sensor in this interval.</p>
      : <SignalTimeline title={channelLabels[window.channel]} unit={unit} points={points} domain={bounds} selection={selection}
        cursor={cursor} onCursor={setCursor} onSelection={setSelection} syncId={recordingId} includeZero={false} />}
    <details className="text-xs"><summary className="min-h-9 cursor-pointer font-medium text-primary">Interval statistics & timing</summary>
      <div className="mt-3 space-y-4">
        <SignalSelectionControls bounds={bounds} selection={selection} onSelection={setSelection} />
        <DetailsList items={[["Selected interval", `${seconds(selection[0])}–${seconds(selection[1])}`], ["Readings", String(stats?.count ?? 0)],
          ["Mean X / Y / Z", stats ? stats.mean.map(v => v.toFixed(4)).join(" / ") : "Unavailable"],
          ["Std. deviation X / Y / Z", stats ? stats.std.map(v => v.toFixed(4)).join(" / ") : "Unavailable"],
          ["Peak magnitude", stats ? `${fixed(stats.peak, 4)} ${unit}` : "Unavailable", <SignalStatisticHelp key="peak" kind="peak" channel={window.channel} count={stats?.count ?? 0} />],
          ["RMS magnitude", stats ? `${fixed(stats.rms, 4)} ${unit}` : "Unavailable", <SignalStatisticHelp key="rms" kind="rms" channel={window.channel} count={stats?.count ?? 0} />],
          ["Axes", "Original phone XYZ"], ["Time basis", "Independent sensor timestamps"], ["Filtering / interpolation", "None"],
          ["Line breaks", "Gaps > 250 ms; repeated/backward times"],
          ...(window.channel === "rotation_vector" ? [["Rotation vector", "XYZ shown; all components retained"] as [string, string]] : [])]} />
      </div>
    </details>
  </div>;
}

function NativePreparation({ inspection, onSaved }: { inspection: NativeInspection; onSaved: (result: ProcessingDetail) => void }) {
  if (inspection.manifest.context.recording_kind === "maneuver_trial") return <NativeSignalWindow record={inspection.recording} channels={boundsOnlyChannels}>
    {(_, bounds) => <ReuseReferenceForm recordingId={inspection.recording.id} bounds={bounds} onSaved={onSaved} />}
  </NativeSignalWindow>;
  return <NativeSignalWindow record={inspection.recording} channels={referenceChannels}>
    {(windows, bounds) => inspection.manifest.context.recording_kind === "forward_reference"
      ? <ForwardReferencePreview recordingId={inspection.recording.id} acceleration={windows[0].events} gyroscope={windows[1].events}
        origin={inspection.manifest.started_elapsed_ns} bounds={bounds} onSaved={onSaved} />
      : <StationaryPreparation windows={windows} origin={inspection.manifest.started_elapsed_ns} bounds={bounds} recordingId={inspection.recording.id} />}
  </NativeSignalWindow>;
}

function StationaryPreparation({ windows, origin, bounds, recordingId }: {
  windows: NativeWindow[]; origin: string; bounds: ReferenceRange; recordingId: string;
}) {
  const [selection, setSelection] = useState<ReferenceRange>(bounds);
  const [cursor, setCursor] = useState(bounds[0]);
  const points = useMemo(() => nativeSignalPoints(windows[0].events, origin), [windows, origin]);
  return <div className="space-y-4">
    <SignalTimeline title="Resting interval" unit="m/s²" points={points} domain={bounds} selection={selection} cursor={cursor}
      onCursor={setCursor} onSelection={setSelection} syncId={recordingId} includeZero={false} />
    <SignalSelectionControls bounds={bounds} selection={selection} onSelection={setSelection} />
    <StationaryReferencePreview key={`${selection[0]}:${selection[1]}`} acceleration={windows[0].events} gyroscope={windows[1].events} origin={origin} selection={selection} />
  </div>;
}
