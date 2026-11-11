'use client';

import Link from 'next/link';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { NativeInspection, NativeStatistics } from '@/services/research/native-types';
import { DetailsList } from './RecordingDetails';
import { AnnotationHistory } from './AnnotationHistory';
import { humanize } from '../recording-analysis';
import { referenceRequirement, timingWarnings } from '../review-workflow';

const stopLabel = (value: string) => ({ brake_applied: 'Applied brake', neutral_release: 'Released to neutral', unknown: 'Not sure', not_applicable: 'Not applicable' }[value] ?? humanize(value));
const fixed = (value: number | null) => value == null ? 'Unavailable' : value.toFixed(2);

export function ReferenceRequirement({ inspection }: { inspection: NativeInspection }) {
  const requirement = referenceRequirement(inspection), reference = inspection.review.processing.reference_recording;
  if (!requirement.message) return null;
  return <div role="status" className="space-y-2 border-l-2 border-warning pl-3">
    <p className="text-sm text-foreground">{requirement.message}</p>
    {reference && <Button asChild variant="outline" size="sm"><Link href={`/admin/research/native/${reference.id}`}>Prepare reference</Link></Button>}
  </div>;
}

export function RecordingChecks({ inspection }: { inspection: NativeInspection }) {
  const { recording, review } = inspection;
  const observation = review.observation, collection = review.collection;
  const issues = timingWarnings(inspection);
  return <div className="space-y-4">
    <DetailsList items={[
      ['Original file', recording.state === 'verified' ? 'Verified' : `${recording.received_chunks}/${recording.expected_chunks} chunks received`],
      ['Capture', humanize(recording.capture_state)],
      ['Collection setup', collection ? `S${String(collection.session_number).padStart(2, '0')} · Mount ${collection.mount_number} · ${collection.protocol_code}` : 'Pilot history — no collection context'],
      ['Observations', observation ? `Synced · revision ${observation.revision}` : 'Not synced — save and sync from the phone'],
      ['Timing', !recording.summary ? 'Not available' : issues.length ? `Needs review: ${issues.join(', ')}` : 'No sequence or timestamp anomalies reported'],
    ]} />
    {observation && <div className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-semibold">Reported run</h3>
      <DetailsList items={[
        ['Completed as planned', observation.completed_as_planned === null ? 'Not sure' : observation.completed_as_planned ? 'Yes' : 'No'],
        ['Stopped by', stopLabel(observation.actual_stop_method)],
        ...(collection && ['LC', 'SW', 'SWL', 'HSWL', 'SWR', 'HSWR'].includes(collection.protocol_code) ? [['Initial deviation', observation.initial_deviation ? humanize(observation.initial_deviation) : 'Not recorded'] as [string, string]] : []),
        ['Report from', humanize(observation.source)],
        ['Observations', observation.flags.length ? observation.flags.map(humanize).join(', ') : 'None reported'],
      ]} />
      {collection && collection.expected_stop_method !== 'not_applicable' && observation.actual_stop_method !== 'unknown' && observation.actual_stop_method !== collection.expected_stop_method &&
        <p className="text-xs text-warning">The planned stop was {stopLabel(collection.expected_stop_method).toLowerCase()}. Label what actually happened.</p>}
      {observation.notes && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{observation.notes}</p>}
    </div>}
    <ReferenceRequirement inspection={inspection} />
  </div>;
}

export function RecordingDetailsDialog({ inspection, annotationState }: { inspection: NativeInspection; annotationState: string }) {
  const { recording, manifest, review } = inspection;
  return <Dialog><DialogTrigger asChild><Button variant="outline" size="sm"><Info className="size-4" />Details</Button></DialogTrigger>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>Recording details</DialogTitle></DialogHeader>
      <DetailsList items={[
        ['Purpose', humanize(manifest.context.recording_kind)], ['Surface', manifest.context.surface], ['Slope', humanize(manifest.context.slope)],
        ['Phone', manifest.device?.model ?? 'Not recorded'], ['RC model', manifest.context.rc_model ?? 'Not recorded'],
        ['Mount method', manifest.context.mount_method], ['Orientation', humanize(manifest.context.mount_orientation)],
        ['Setup check', review.collection ? `${humanize(review.collection.preflight_result)} · pilot only` : 'Not recorded'],
        ['Interval labels', humanize(annotationState)], ['Source', 'Android SensorManager'], ['Coordinates', 'Android natural device axes'],
      ]} />
      <details className="border-t border-border pt-3"><summary className="min-h-9 cursor-pointer text-sm font-medium">Sensor timing</summary>
        <div className="mt-2 space-y-4">{Object.entries(recording.summary ?? {}).map(([channel, stats]) => <ChannelQuality key={channel} title={humanize(channel)} stats={stats} />)}</div>
      </details>
      <details className="border-t border-border pt-3"><summary className="min-h-9 cursor-pointer text-sm font-medium">Label history</summary><AnnotationHistory recordingId={recording.id} /></details>
      <details className="border-t border-border pt-3 text-xs"><summary className="min-h-9 cursor-pointer font-medium">Original file fingerprint</summary><p className="break-all text-muted-foreground">SHA-256: {recording.manifest_sha256}</p></details>
    </DialogContent>
  </Dialog>;
}

function ChannelQuality({ title, stats }: { title: string; stats: NativeStatistics }) {
  return <div className="space-y-2"><h3 className="text-sm font-semibold">{title}</h3><DetailsList items={[
    ['Readings', String(stats.event_count)], ['Delivered rate (Hz)', fixed(stats.rate_hz)], ['Largest gap (ms)', fixed(stats.max_gap_ms)],
    ['Startup / trailing gap (ms)', `${fixed(stats.startup_gap_ms)} / ${fixed(stats.trailing_gap_ms)}`],
    ['Repeated / backward timestamps', `${stats.duplicate_timestamps} / ${stats.backwards_timestamps}`],
    ['Sequence gaps', String(stats.sequence_gaps)], ['Outside capture interval', String(stats.out_of_interval)],
  ]} /></div>;
}
