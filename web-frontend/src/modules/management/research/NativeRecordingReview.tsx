"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SummaryList } from "@/components/common/data-display/SummaryList";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { ReuseReferenceForm } from "@/forms/research/ReuseReferenceForm";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getNativeInspection } from "@/services/research/native-research.service";
import type { NativeChannel, NativeInspection, NativeWindow } from "@/services/research/native-types";
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
import { seconds } from "./recording-analysis";
import { nativeIntervalStats, nativeSignalPoints } from "./native-analysis";
import { MetadataList } from "@/components/common/data-display/MetadataList";
import { recordingPresentation } from "./recording-presentation";
import { RecordingChecks, RecordingDetailsDialog, ReferenceRequirement } from "./components/RecordingChecks";
import { ReviewTimelineProvider, useReviewSelection } from "./components/ReviewTimelineContext";
import { referenceRequirement } from "./review-workflow";

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
  const presentation = inspection ? recordingPresentation({ name: inspection.recording.name, displayCode: inspection.recording.display_code, surface: inspection.recording.surface }) : null;
  return <section className="space-y-5 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <Link href="/admin/research" className="group -ml-1.5 flex shrink-0 items-center gap-1.5 rounded-md p-1.5 text-xs text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <ChevronLeft size={15} className="transition-transform group-hover:-translate-x-0.5" />Recordings
        </Link>
        {inspection && !error && <><span aria-hidden="true" className="text-border">/</span><h1 aria-current="page" className="min-w-0 break-words text-xs font-semibold text-foreground">{presentation?.title}</h1></>}
      </nav>
      {inspection && !error && <time dateTime={inspection.recording.started_at} className="text-xs text-muted-foreground">{formatReturnDateTime(inspection.recording.started_at)}</time>}
    </header>
    {!error && presentation?.metadata.length ? <MetadataList className="sm:grid-cols-4" items={presentation.metadata} /> : null}
    {loading || error || !inspection ? <ResearchState loading={loading} error={error} onRetry={() => { setLoading(true); setRevision(v => v + 1); }} /> : <NativeWorkspace key={inspection.recording.id} inspection={inspection} />}
  </section>;
}

function NativeWorkspace({ inspection }: { inspection: NativeInspection }) {
  const { recording: record, review } = inspection;
  const [step, setStep] = useState(record.annotation_state !== "unlabeled" ? "labels" : review.processing.saved_runs ? "prepare" : "check");
  const [labelsOpened, setLabelsOpened] = useState(record.annotation_state !== "unlabeled");
  const [savedResult, setSavedResult] = useState<ProcessingDetail | null>(null);
  const [prepareNew, setPrepareNew] = useState(false);
  const [annotationState, setAnnotationState] = useState(record.annotation_state);
  const blocked = referenceRequirement(inspection).blocked;
  const inspectable = record.state === "verified" && record.duration_ms > 0;
  const hasResult = Boolean(savedResult || review.processing.saved_runs);
  const openStep = (value: string) => { setStep(value); if (value === "labels") setLabelsOpened(true); };
  return <ReviewTimelineProvider duration={record.duration_ms}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <SummaryList label="Recording summary" items={[
        { label: "seconds", value: (record.duration_ms / 1000).toFixed(2) },
        { label: "readings", value: record.summary?.accelerometer?.event_count.toLocaleString() ?? "Pending" },
        { label: "Hz", value: fixed(record.summary?.accelerometer?.rate_hz, 1) },
      ]} />
      <RecordingDetailsDialog inspection={inspection} annotationState={annotationState} />
    </div>
    <Card className="min-w-0 border-border bg-surface shadow-none ring-0"><Tabs value={step} onValueChange={openStep}>
      <CardHeader className="border-b border-border p-3 sm:p-4"><TabsList aria-label="Recording review steps" className="grid h-auto! w-full grid-cols-3 gap-1">
        <TabsTrigger value="check" className="h-auto min-h-10 whitespace-normal px-2 py-2 text-xs">1. Check recording</TabsTrigger>
        <TabsTrigger value="prepare" className="h-auto min-h-10 whitespace-normal px-2 py-2 text-xs">2. Prepare signals</TabsTrigger>
        <TabsTrigger value="labels" className="h-auto min-h-10 whitespace-normal px-2 py-2 text-xs">3. Label and review</TabsTrigger>
      </TabsList></CardHeader>
      <TabsContent value="check" className="mt-0"><CardContent className="space-y-5 pt-4">
        <RecordingChecks inspection={inspection} />
        {inspectable && <OriginalSignals inspection={inspection} viewControl={null} />}
        {inspectable && <div className="flex flex-wrap justify-end gap-2">
          {blocked ? <Button onClick={() => openStep("labels")}>Label original signals</Button> : <Button onClick={() => openStep("prepare")}>Continue to preparation</Button>}
        </div>}
      </CardContent></TabsContent>
      <TabsContent value="prepare" className="mt-0"><CardContent className="space-y-5 pt-4">
        {!inspectable ? <p className="text-sm text-muted-foreground">Upload and verify a recording with sensor readings first.</p> : <>
          <ReferenceRequirement inspection={inspection} />
          {blocked && !hasResult && <Button variant="outline" onClick={() => openStep("labels")}>Label original signals</Button>}
          {hasResult && !prepareNew ? <>
            <ProcessingRuns key={savedResult?.run.id ?? record.id} recordingId={record.id} initialResult={savedResult} viewControl={null} />
            <div className="flex flex-wrap justify-end gap-2">
              {!blocked && <Button variant="outline" onClick={() => setPrepareNew(true)}>New processing run</Button>}
              <Button onClick={() => openStep("labels")}>Continue to labels</Button>
            </div>
          </> : <>
            {!blocked && <NativePreparation inspection={inspection} onSaved={result => { setSavedResult(result); setPrepareNew(false); }} />}
            {prepareNew && <Button variant="outline" onClick={() => setPrepareNew(false)}>Back to saved result</Button>}
          </>}
        </>}
      </CardContent></TabsContent>
      {labelsOpened && <TabsContent value="labels" forceMount className="mt-0 data-[state=inactive]:hidden"><CardContent className="space-y-4 pt-4">
        {!inspectable ? <p className="text-sm text-muted-foreground">Finish uploading before labeling intervals.</p> : <>
          {!hasResult && <p className="text-xs text-muted-foreground">Labeling original signals. No processed result is saved for this recording.</p>}
          <NativeAnnotations inspection={inspection} onState={setAnnotationState} />
        </>}
      </CardContent></TabsContent>}
    </Tabs></Card>
  </ReviewTimelineProvider>;
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
  const { selection, setSelection, cursor, setCursor } = useReviewSelection(bounds);
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
  const { selection, setSelection, cursor, setCursor } = useReviewSelection(bounds);
  const points = useMemo(() => nativeSignalPoints(windows[0].events, origin), [windows, origin]);
  return <div className="space-y-4">
    <SignalTimeline title="Resting interval" unit="m/s²" points={points} domain={bounds} selection={selection} cursor={cursor}
      onCursor={setCursor} onSelection={setSelection} syncId={recordingId} includeZero={false} />
    <SignalSelectionControls bounds={bounds} selection={selection} onSelection={setSelection} />
    <StationaryReferencePreview key={`${selection[0]}:${selection[1]}`} acceleration={windows[0].events} gyroscope={windows[1].events} origin={origin} selection={selection} />
  </div>;
}
