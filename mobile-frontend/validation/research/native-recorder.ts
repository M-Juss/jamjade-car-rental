import { z } from 'zod';

import { NATIVE_MOUNT_METHOD } from '@/lib/research/native-recorder';

// Local-only native contract; no v2 motion upload endpoint exists yet. RcRecorderEngine validates it again.
const text = (label: string) => z.string().trim().min(1, `Enter ${label}.`).max(100, 'Use at most 100 characters.');
const recordingKind = z.enum(['maneuver_trial', 'stationary_reference', 'forward_reference']);
const conditions = {
  surface: text('the surface'), mount_method: z.literal(NATIVE_MOUNT_METHOD), slope: z.enum(['level', 'uphill', 'downhill']),
};
export const nativeCollectionGroupSchema = z.object({ name: text('a group name'), ...conditions, recording_kind: recordingKind }).strict();
export const nativeCollectionGroupFormSchema = nativeCollectionGroupSchema.omit({ name: true });
export type NativeCollectionGroupInput = z.infer<typeof nativeCollectionGroupFormSchema>;
export const nativeRecordingSchema = z.object({
  recording_group_id: z.uuid('Select a collection group.'), ...conditions,
  recording_kind: recordingKind,
  consent: z.boolean().refine(Boolean, 'Agree to motion recording before starting.'),
}).strict();
export type NativeRecordingInput = z.infer<typeof nativeRecordingSchema>;
