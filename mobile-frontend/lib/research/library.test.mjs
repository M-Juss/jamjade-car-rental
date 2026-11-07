import assert from 'node:assert/strict';
import test from 'node:test';
import { recordingLibraryStatus } from './library.ts';

const saved = { state: 'stopped', transfer_state: 'uploaded' };
test('a cached verified receipt never appears freshly verified', () => {
  assert.deepEqual(recordingLibraryStatus(saved), { label: 'Verified', note: 'Cached receipt' });
  assert.deepEqual(recordingLibraryStatus(saved, { state: 'verified' }), { label: 'Verified' });
  assert.deepEqual(recordingLibraryStatus(saved, { state: 'incomplete' }), { label: 'Upload incomplete' });
});
test('pending setup and observations stay visible independently of verified originals', () => {
  const record = { ...saved, collection: { observations: [{ revision: 1 }], sync: { context_synced: true, observation_revision: 0 } } };
  assert.deepEqual(recordingLibraryStatus({ ...record, collection: { observations: [] } }), { label: 'Setup pending sync' });
  assert.deepEqual(recordingLibraryStatus(record), { label: 'Observations pending sync' });
  assert.deepEqual(recordingLibraryStatus(record, { state: 'verified', observation_revision: 2 }), { label: 'Newer observations on server' });
});
test('interrupted, unreadable and failed uploads are not presented as ready data', () => {
  assert.deepEqual(recordingLibraryStatus({ ...saved, state: 'interrupted' }), { label: 'Interrupted', note: 'Review needed' });
  assert.deepEqual(recordingLibraryStatus({ ...saved, state: 'unavailable' }), { label: 'File unavailable' });
  assert.deepEqual(recordingLibraryStatus({ ...saved, transfer_state: 'upload_failed' }), { label: 'Upload failed' });
});
