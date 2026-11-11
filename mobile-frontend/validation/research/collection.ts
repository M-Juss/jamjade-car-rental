import { z } from 'zod';

const uuid = z.uuid();
const time = z.iso.datetime({ offset: true });
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const directionalSwerveCodes = ['SWL', 'HSWL', 'SWR', 'HSWR'] as const;
export const exerciseCodeSchema = z.enum(['FSS', 'HA', 'HB', 'LT', 'HLT', 'RT', 'HRT', 'RSS', 'LC', 'SW', ...directionalSwerveCodes, 'MD', 'SR', 'FR']);
const catalogVersion = z.enum(['rc-exercises-v1', 'rc-exercises-v2', 'rc-exercises-v3', 'rc-exercises-v4', 'rc-exercises-v5', 'rc-exercises-v6']);
const ns = z.string().regex(/^[1-9][0-9]{0,18}$/).refine(v => BigInt(v) <= 9223372036854775807n);
const stats = z.object({ count: z.number().int().min(2).max(100000), rejected_count: z.literal(0),
  mean: z.array(z.number().min(-100000).max(100000)).length(3), std: z.array(z.number().min(0).max(100000)).length(3),
  rms: z.number().min(0).max(100000), rate_hz: z.number().min(0).max(100000), max_gap_ms: z.number().min(0).max(100000),
}).strict();
export const sessionSchema = z.object({ id: uuid, device_profile_id: uuid, session_number: z.number().int().min(1).max(999999999),
  recording_group_id: uuid, opened_at: time, conditions: z.object({ surface: z.string().min(1).max(100), slope: z.enum(['level', 'uphill', 'downhill']) }).strict(),
  preset_id: z.literal('mn82s_roof_v1'), catalog_version: catalogVersion, operator_code: z.string().regex(/^OP[0-9]{2,4}$/),
}).strict();
const mountSchema = z.object({ id: uuid, research_session_id: uuid, mount_number: z.number().int().min(1).max(999999),
  reason: z.enum(['initial', 'remounted', 'repositioned', 'suspected_shift']), created_at: time,
  preset_id: z.literal('mn82s_roof_v1'), alignment_status: z.literal('pending'),
}).strict();
const preflightSchema = z.object({ id: uuid, mount_version_id: uuid, clock_context_id: uuid, consent_version: z.literal('rc-preflight-v1'),
  consented_at: time, started_at: time, start_elapsed_ns: ns, end_elapsed_ns: ns, window_ms: z.number().min(5000).max(30000),
  summary_method_version: z.literal('rest-welford-v1'), criteria_version: z.null(), holder_locked: z.literal(true), phone_top_forward: z.literal(true), rc_still: z.literal(true),
  measurements: z.object({ accelerometer: stats, gyroscope: stats }).strict(),
  checks: z.object({ sensors: z.literal('passed'), timing: z.literal('inconclusive'), orientation: z.literal('inconclusive'), stability: z.literal('inconclusive') }).strict(),
  result: z.literal('inconclusive'),
}).strict();
export const collectionContextSchema = z.object({ contract_version: z.literal('rc-collection-v1'), recording_id: uuid, manifest_sha256: hash,
  session: sessionSchema, mount: mountSchema, preflight: preflightSchema, capture_number: z.number().int().min(1).max(999999999),
  protocol_code: exerciseCodeSchema, catalog_version: catalogVersion, protocol_sha256: hash,
}).strict().superRefine((v, ctx) => {
  const version = catalogVersion.options.indexOf(v.catalog_version) + 1;
  const supported = v.protocol_code === 'MD' ? version === 6
    : directionalSwerveCodes.some(code => code === v.protocol_code) ? version >= 5
    : v.protocol_code === 'SW' ? version < 5
    : v.protocol_code === 'LC' ? version >= 4
    : !['HLT', 'HRT'].includes(v.protocol_code) || version >= 3;
  if (!supported) {
    ctx.addIssue({ code: 'custom', path: ['protocol_code'], message: 'This exercise requires an updated exercise catalog.' });
  }
  const p = v.preflight;
  if (v.mount.research_session_id !== v.session.id || p.mount_version_id !== v.mount.id) ctx.addIssue({ code: 'custom', path: ['mount'], message: 'Mount does not match this session.' });
  const delta = BigInt(p.end_elapsed_ns) - BigInt(p.start_elapsed_ns);
  if (delta <= 0n || Math.abs(Number(delta) / 1e6 - p.window_ms) > 0.001) ctx.addIssue({ code: 'custom', path: ['preflight'], message: 'Setup timing is inconsistent.' });
  if (Date.parse(p.consented_at) > Date.parse(p.started_at) || Date.parse(v.session.opened_at) > Date.parse(v.mount.created_at) || Date.parse(v.mount.created_at) > Date.parse(p.started_at)) ctx.addIssue({ code: 'custom', path: ['preflight'], message: 'Setup times are out of order.' });
});
export const observationFlags = ['steering_corrections', 'unexpected_reverse', 'unexpected_turn', 'bump', 'cone_contact', 'phone_shift', 'holder_loose', 'interrupted', 'not_sure'] as const;
export const initialDeviations = ['left', 'right', 'unknown'] as const;
export const observationInputSchema = z.object({ base_revision: z.number().int().min(0).max(99),
  completed_as_planned: z.boolean().nullable(), source: z.enum(['observed', 'operator_report', 'signal_review']),
  observer_code: z.string().regex(/^OB[0-9]{2,4}$/).nullable(), flags: z.array(z.enum(observationFlags)).max(9).refine(v => new Set(v).size === v.length),
  actual_stop_method: z.enum(['brake_applied', 'neutral_release', 'unknown', 'not_applicable']), notes: z.string().max(1000).nullable(),
  initial_deviation: z.enum(initialDeviations).optional(),
}).strict().refine(v => v.source !== 'observed' || v.observer_code !== null, { path: ['observer_code'], message: 'Select the observer code.' });
export const observationUploadSchema = observationInputSchema.safeExtend({ id: uuid, reported_at: time });
export const collectionSessionFormSchema = z.object({ group_id: uuid });
export const collectionExerciseFormSchema = z.object({ protocol_code: exerciseCodeSchema });
export type ObservationInput = z.infer<typeof observationInputSchema>;
export type CollectionContextInput = z.infer<typeof collectionContextSchema>;
export type ResearchSession = z.infer<typeof sessionSchema>;
export type ExerciseCode = z.infer<typeof exerciseCodeSchema>;
