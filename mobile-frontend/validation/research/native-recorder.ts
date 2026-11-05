import { z } from 'zod';

import { NATIVE_MOUNT_METHOD } from '@/lib/research/native-recorder';

// Recorder configuration is validated again by the native actor.
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
  protocol_code: z.enum(['FSS', 'HA', 'HB', 'LT', 'RT', 'RSS', 'SW', 'SR', 'FR']).optional(), preflight_id: z.uuid().optional(),
  consent: z.boolean().refine(Boolean, 'Agree to motion recording before starting.'),
}).strict().refine(v => Boolean(v.protocol_code) === Boolean(v.preflight_id), { path: ['preflight_id'], message: 'Run setup checks for this exercise.' })
  .refine(v => !v.protocol_code || v.recording_kind === (v.protocol_code === 'FR' ? 'forward_reference' : v.protocol_code === 'SR' ? 'stationary_reference' : 'maneuver_trial'), { path: ['protocol_code'], message: 'Exercise does not match the recording purpose.' });
export type NativeRecordingInput = z.infer<typeof nativeRecordingSchema>;
