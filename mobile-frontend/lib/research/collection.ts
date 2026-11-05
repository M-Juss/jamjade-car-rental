import catalog from '@/assets/research/rc-exercises-v1.json';
import type { CollectionContextInput, ObservationInput, ResearchSession } from '@/validation/research/collection';

export const exerciseCatalog = catalog;
export type ExerciseProtocol = typeof catalog.protocols[number];
export type ObservationRevision = Omit<ObservationInput, 'base_revision'> & { id: string; revision: number; reported_at: string };
export type CollectionState = { session?: ResearchSession; mount?: CollectionContextInput['mount'] };
export type SetupEvidence = Omit<CollectionContextInput['preflight'], 'result' | 'checks' | 'measurements'> & {
  result: 'failed' | 'inconclusive'; measurements: Record<'accelerometer' | 'gyroscope', {
    count: number; rejected_count: number; mean: number[] | null; std: number[] | null; rms: number | null; rate_hz: number | null; max_gap_ms: number | null;
  }>;
};
export type CollectionStatus = { id: string; client_recording_id: string; name: string; state: 'verified' | 'incomplete'; manifest_sha256: string;
  context_synced: boolean; display_code: string | null; observation_revision: number; annotation_version: 'rc-phase-labels-v1'; annotation_state: string; checked_at: string };
export type RecordingCollection = Omit<CollectionContextInput, 'manifest_sha256'> & {
  display_code: string; capture_stage: 'pilot'; protocol_snapshot: ExerciseProtocol;
  observations?: ObservationRevision[]; sync?: Pick<CollectionStatus, 'context_synced' | 'observation_revision' | 'annotation_state' | 'checked_at'>;
};
export const observationFlagLabels: Record<ObservationInput['flags'][number], string> = {
  steering_corrections: 'Steering corrections', unexpected_reverse: 'Unexpected reverse', unexpected_turn: 'Unexpected turn', bump: 'Bump',
  cone_contact: 'Cone contact', phone_shift: 'Phone shifted', holder_loose: 'Holder loose', interrupted: 'Interrupted', not_sure: 'Not sure',
};
export function recordingTitle(record: { context?: { name?: string }; collection?: RecordingCollection | null }) {
  return record.collection?.display_code ?? record.context?.name ?? 'Unavailable recording';
}
