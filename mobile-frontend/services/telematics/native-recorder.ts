import { AppState, PermissionsAndroid, Platform } from 'react-native';

import nativeModule from '@/modules/rc-recorder';
import { nativeCollectionGroupName, type NativeRecorderState, type NativeRecording, type NativeCollectionGroup, type NativeGroupCatalog } from '@/lib/research/native-recorder';
import { apiGet } from '@/services/http';
import { nativeCollectionGroupFormSchema, nativeCollectionGroupSchema, nativeRecordingSchema, type NativeCollectionGroupInput, type NativeRecordingInput } from '@/validation/research/native-recorder';

type NativeAccess = { owner_id: string; valid_for_seconds: number; expires_at: string; capture_protocol_version: 2; upload_available: false };
let authorizedOwner: number | null = null;
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
    });
  },
  async lock() {
    accessRevision++;
    authorizedOwner = null;
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
  async remove(id: string) { await moduleOrThrow().delete(id); },
  isAuthorized(ownerId: number) { return authorizedOwner === ownerId; },
};
