import { z } from 'zod';

const acceptedBoolean = z.union([z.literal(true), z.literal(1), z.literal('1')]);
const captureDate = z.iso.datetime({ precision: 3 });
const bounded = (min: number, max: number, integer = false) => z.preprocess(
  (value) => typeof value === 'string' && value.trim() !== '' ? Number(value) : value,
  (integer ? z.number().int() : z.number()).min(min).max(max),
);

// Mirrors StoreSetupAttemptRequest::calibrationEvidenceRules. Server state,
// freshness, recording quality and release readiness remain Laravel decisions.
export const calibrationEvidenceSchema = z.object({
  protocol_version: bounded(3, 3, true),
  context: z.string().regex(/^[a-f0-9]{64}$/),
  consent: acceptedBoolean,
  supervised: acceptedBoolean,
  started_at: captureDate,
  ended_at: captureDate,
  forward_x: bounded(-100, 100),
  forward_y: bounded(-100, 100),
  forward_z: bounded(-100, 100),
  forward_duration_ms: bounded(0, 1000),
  forward_sample_count: bounded(0, 40, true),
  forward_coherence: bounded(0, 1),
  sample_count: bounded(1, 2000, true),
  sensor_duration_ms: bounded(0, 60000),
  max_gap_ms: bounded(0, 60000),
  linear_rms: bounded(0, 100),
  linear_mean_x: bounded(-100, 100),
  linear_mean_y: bounded(-100, 100),
  linear_mean_z: bounded(-100, 100),
  linear_stddev: bounded(0, 100),
  horizontal_rms: bounded(0, 100),
  rotation_mean_x: bounded(-2000, 2000),
  rotation_mean_y: bounded(-2000, 2000),
  rotation_mean_z: bounded(-2000, 2000),
  rotation_rms: bounded(0, 2000),
  rotation_stddev: bounded(0, 2000),
  rotation_peak: bounded(0, 2000),
  longitudinal_min: bounded(-100, 100),
  longitudinal_max: bounded(-100, 100),
  yaw_left_degrees: bounded(0, 720),
  yaw_right_degrees: bounded(0, 720),
  max_tilt_degrees: bounded(0, 180),
  gravity_x: bounded(-20, 20),
  gravity_y: bounded(-20, 20),
  gravity_z: bounded(-20, 20),
}).strict().superRefine((values, context) => {
  if (Date.parse(values.ended_at) <= Date.parse(values.started_at)) context.addIssue({ code: 'custom', path: ['ended_at'], message: 'Recording must end after it starts.' });
  if (values.longitudinal_max < values.longitudinal_min) context.addIssue({ code: 'custom', path: ['longitudinal_max'], message: 'Motion summary is inconsistent.' });
});

export const calibrationConsentSchema = z.object({
  consent: z.boolean().refine(Boolean, 'Agree to the short motion recording before continuing.'),
  supervised: z.boolean().refine(Boolean, 'Confirm staff supervision and that the vehicle is parked before continuing.'),
});
export type CalibrationConsentInput = z.infer<typeof calibrationConsentSchema>;
