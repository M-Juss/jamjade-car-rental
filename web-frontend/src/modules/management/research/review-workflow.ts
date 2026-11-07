import type { NativeInspection } from '@/services/research/native-types';

export function referenceRequirement(inspection: NativeInspection): { blocked: boolean; message: string | null } {
  const status = inspection.review.processing.reference_status;
  if (status === 'missing') return { blocked: true, message: 'No earlier reference for this session and mount. Review original signals; capture a forward reference before the next trial.' };
  if (status === 'needs_processing') return { blocked: true, message: 'Prepare the uploaded forward reference before processing this trial.' };
  return { blocked: false, message: null };
}
export function boundedSelection(selection: [number, number], bounds: [number, number]): [number, number] {
  const start = Math.max(bounds[0], selection[0]), end = Math.min(bounds[1], selection[1]);
  return end > start ? [start, end] : [...bounds];
}
export function timingWarnings(inspection: NativeInspection): string[] {
  const issues: string[] = [];
  for (const [channel, stats] of Object.entries(inspection.recording.summary ?? {})) {
    if (stats && (stats.sequence_gaps || stats.duplicate_timestamps || stats.backwards_timestamps || stats.out_of_interval)) issues.push(channel.replaceAll('_', ' '));
  }
  return issues;
}
