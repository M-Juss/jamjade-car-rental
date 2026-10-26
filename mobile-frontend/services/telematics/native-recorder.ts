import { AppState, PermissionsAndroid, Platform } from 'react-native';

import nativeModule from '@/modules/rc-recorder';
import { nativeCollectionGroupName, type NativeRecorderState, type NativeRecording, type NativeCollectionGroup, type NativeGroupCatalog } from '@/lib/research/native-recorder';
import { apiGet, apiPost, getApiAuthToken } from '@/services/http';
import { nativeCollectionGroupFormSchema, nativeCollectionGroupSchema, nativeRecordingSchema, type NativeCollectionGroupInput, type NativeRecordingInput } from '@/validation/research/native-recorder';
import { nativeManifestUploadSchema, nativeChunkUploadSchema, nativeUploadIdSchema } from '@/validation/research/native-upload';

type NativeAccess = { owner_id: string; valid_for_seconds: number; expires_at: string; capture_protocol_version: 2; upload_available: boolean };
type NativeUploadReceipt = { id: string; client_recording_id: string; manifest_sha256: string; state: 'incomplete' | 'verified';
  expected_chunks: number; received_chunks: number; accepted_chunks?: { channel: string; chunk_index: number }[] };
type ExportedManifest = { manifest_json: string; manifest_sha256: string };
type UploadManifest = { recording_id: string; chunks: { channel: 'accelerometer' | 'gyroscope' | 'gravity' | 'linear_acceleration' | 'rotation_vector'; chunk_index: number }[] };
let authorizedOwner: number | null = null;
let serverUploadAvailable = false;
const uploading = new Set<string>();
let accessRevision = 0;
let mutations: Promise<unknown> = Promise.resolve();
export class NativeRecorderError extends Error {}

function mutate<T>(action: () => Promise<T>): Promise<T> {
  const result = mutations.then(action);
  mutations = result.catch(() => undefined);
  return result;
}

function checkRevision(revision: number) {
  if (revision !== accessRevision) throw new NativeRecorderError('Research access changed. Sign in again.');
}

function moduleOrThrow() {
  if (!nativeModule || typeof nativeModule.groups !== 'function' || typeof nativeModule.createGroup !== 'function') {
    throw new NativeRecorderError('Install the updated Android development build for collection groups and phone power information.');
  }
  return nativeModule;
}

export const nativeRecorder = {
  available: nativeModule !== null && typeof nativeModule.groups === 'function' && typeof nativeModule.createGroup === 'function',
  uploadAvailable: nativeModule !== null && typeof nativeModule.exportManifest === 'function'
    && typeof nativeModule.exportChunk === 'function' && typeof nativeModule.setTransfer === 'function',
  async authorize(ownerId: number) {
    const module = moduleOrThrow();
    const revision = accessRevision;
    const started = performance.now();
    const { data } = await apiGet<NativeAccess>('/mobile/rc-research/native-access');
    const seconds = Math.floor(data.valid_for_seconds - (performance.now() - started) / 1000);
    if (data.owner_id !== String(ownerId) || data.capture_protocol_version !== 2 || !Number.isFinite(seconds) || seconds < 1 || seconds > 28800) {
      throw new NativeRecorderError('Research access could not be verified. Sign in again.');
    }
    await mutate(async () => {
      checkRevision(revision);
      await module.authorize(data.owner_id, seconds);
      checkRevision(revision);
      authorizedOwner = ownerId;
      serverUploadAvailable = data.upload_available;
    });
  },
  async lock() {
    accessRevision++;
    authorizedOwner = null;
    serverUploadAvailable = false;
    const module = nativeModule;
    if (module) await mutate(() => module.lock());
  },
  async start(ownerId: number, values: NativeRecordingInput) {
    const revision = accessRevision;
    if (AppState.currentState !== 'active') throw new NativeRecorderError('Open RC Research before starting.');
    const config = nativeRecordingSchema.parse(values);
    await this.authorize(ownerId);
    if (Number(Platform.Version) >= 33) {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS, {
        title: 'Recording notification', message: 'Show the recording status and a Stop action while the screen is locked.',
        buttonPositive: 'Continue', buttonNegative: 'Cancel',
      });
      if (result !== PermissionsAndroid.RESULTS.GRANTED) throw new NativeRecorderError('Allow recording notifications before starting.');
    }
    await mutate(async () => {
      checkRevision(revision);
      if (AppState.currentState !== 'active') throw new NativeRecorderError('Open RC Research before starting.');
      await moduleOrThrow().start(JSON.stringify(config));
    });
  },
  async stop() { await moduleOrThrow().stop(); },
  async status(): Promise<NativeRecorderState> { return JSON.parse(await moduleOrThrow().status()); },
  async list(offset = 0): Promise<NativeRecording[]> { return JSON.parse(await moduleOrThrow().list(offset)); },
  async groups(): Promise<NativeGroupCatalog> { return JSON.parse(await moduleOrThrow().groups()); },
  async createGroup(values: NativeCollectionGroupInput): Promise<NativeCollectionGroup> {
    const conditions = nativeCollectionGroupFormSchema.parse(values);
    const revision = accessRevision;
    return mutate(async () => {
      checkRevision(revision);
      if (authorizedOwner === null) throw new NativeRecorderError('Verify research access before creating a group.');
      const module = moduleOrThrow();
      const catalog: NativeGroupCatalog = JSON.parse(await module.groups());
      checkRevision(revision);
      const config = nativeCollectionGroupSchema.parse({ ...conditions, name: nativeCollectionGroupName(conditions, catalog.groups) });
      const result = await module.createGroup(JSON.stringify(config));
      checkRevision(revision);
      return JSON.parse(result);
    });
  },
  async details(id: string): Promise<NativeRecording> { return JSON.parse(await moduleOrThrow().details(id)); },
  async upload(ownerId: number, id: string, onProgress: (sent: number, total: number) => void = () => {}) {
    nativeUploadIdSchema.parse(id);
    if (!this.uploadAvailable) throw new NativeRecorderError('Install the updated Android app to upload recordings.');
    if (uploading.size) throw new NativeRecorderError('Wait for the current recording upload.');
    const revision = accessRevision;
    uploading.add(id);
    const module = moduleOrThrow();
    try {
      await this.authorize(ownerId);
      checkRevision(revision);
      if (!serverUploadAvailable) throw new NativeRecorderError('Native recording upload is unavailable on this server.');
      const authToken = await getApiAuthToken();
      checkRevision(revision);
      if (!authToken) throw new NativeRecorderError('Sign in again before uploading.');
      const nativeCall = <T>(action: () => Promise<T>) => mutate(async () => { checkRevision(revision); return action(); });
      const exported: ExportedManifest = JSON.parse(await nativeCall(() => module.exportManifest(id)));
      checkRevision(revision);
      const manifest: UploadManifest = JSON.parse(exported.manifest_json);
      if (manifest.recording_id !== id) throw new NativeRecorderError('The recording identity could not be verified.');
      await nativeCall(() => module.setTransfer(id, JSON.stringify({ state: 'uploading' })));
      checkRevision(revision);
      const receipt = (await apiPost<NativeUploadReceipt>('/mobile/rc-research/native-recordings', nativeManifestUploadSchema.parse({ manifest_json: exported.manifest_json }), { authToken })).data;
      checkRevision(revision);
      nativeUploadIdSchema.parse(receipt.id);
      if (receipt.client_recording_id !== id || receipt.manifest_sha256 !== exported.manifest_sha256) throw new NativeRecorderError('The server returned a different recording.');
      const accepted = new Set((receipt.accepted_chunks ?? []).map(chunk => `${chunk.channel}/${chunk.chunk_index}`));
      let sent = 0;
      for (const chunk of manifest.chunks) {
        checkRevision(revision);
        if (!accepted.has(`${chunk.channel}/${chunk.chunk_index}`)) {
          const payload = await nativeCall(() => module.exportChunk(id, chunk.channel, chunk.chunk_index));
          checkRevision(revision);
          await apiPost(`/mobile/rc-research/native-recordings/${receipt.id}/chunks`, nativeChunkUploadSchema.parse({ channel: chunk.channel, chunk_index: chunk.chunk_index, payload }), { authToken });
          checkRevision(revision);
        }
        onProgress(++sent, manifest.chunks.length);
      }
      const final = (await apiPost<NativeUploadReceipt>(`/mobile/rc-research/native-recordings/${receipt.id}/finalize`, undefined, { authToken })).data;
      checkRevision(revision);
      if (final.state !== 'verified' || final.id !== receipt.id || final.client_recording_id !== id
        || final.manifest_sha256 !== exported.manifest_sha256 || final.received_chunks !== manifest.chunks.length || final.expected_chunks !== manifest.chunks.length) {
        throw new NativeRecorderError('The server has not verified the complete recording. Retry upload.');
      }
      await nativeCall(() => module.setTransfer(id, JSON.stringify({ state: 'uploaded', server_id: receipt.id, manifest_sha256: exported.manifest_sha256 })));
      checkRevision(revision);
    } catch (error) {
      if (revision === accessRevision && authorizedOwner === ownerId) {
        try { await mutate(async () => { checkRevision(revision); await module.setTransfer(id, JSON.stringify({ state: 'upload_failed' })); }); } catch { /* Keep originals if access/storage is unavailable. */ }
      }
      throw error;
    } finally { uploading.delete(id); }
  },
  async remove(id: string) { await moduleOrThrow().delete(id); },
  isAuthorized(ownerId: number) { return authorizedOwner === ownerId; },
};
