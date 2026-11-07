import type { CollectionStatus } from './collection';
import type { NativeRecording } from './native-recorder';

export function recordingLibraryStatus(record: NativeRecording, server?: CollectionStatus): { label: string; note?: string } {
  if (record.state === 'unavailable') return { label: 'File unavailable' };
  if (record.collection_error) return { label: 'Setup details unavailable' };
  if (record.state === 'interrupted') return { label: 'Interrupted', note: 'Review needed' };
  if (server?.state === 'incomplete') return { label: 'Upload incomplete' };
  if (record.transfer_state === 'upload_failed') return { label: 'Upload failed' };
  if (record.transfer_state !== 'uploaded') return { label: 'Saved on phone' };
  if (record.collection) {
    const count = record.collection.observations?.length ?? 0;
    if ((server?.observation_revision ?? 0) > count) return { label: 'Newer observations on server' };
    if (!(server?.context_synced ?? record.collection.sync?.context_synced)) return { label: 'Setup pending sync' };
    if (!count) return { label: 'Needs observations' };
    if ((record.collection.sync?.observation_revision ?? 0) < count) return { label: 'Observations pending sync' };
  }
  return server?.state === 'verified' ? { label: 'Verified' } : { label: 'Verified', note: 'Cached receipt' };
}
