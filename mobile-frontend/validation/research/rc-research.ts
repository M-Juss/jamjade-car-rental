import { z } from 'zod';

export const rcMovementSchema = z.enum(['stationary', 'steady_movement', 'acceleration', 'braking', 'left_turn', 'right_turn'], { error: 'Choose a movement.' });
export const rcIntensitySchema = z.enum(['normal', 'harsh', 'not_applicable'], { error: 'Choose an intensity.' });
export const needsIntensity = (movement: string) => movement !== 'stationary' && movement !== 'steady_movement';
const text = (label: string) => z.string().trim().min(1, `Enter ${label}.`).max(100, 'Use at most 100 characters.');

// Metadata mirrors StoreRcResearchSessionRequest. Movement is submitted later
// through StoreRcResearchTrialRequest. The primary action explicitly records consent.
export const rcSessionSetupSchema = z.object({
  name: text('a session name'), surface: text('the surface'),
  slope: z.enum(['level', 'uphill', 'downhill'], { error: 'Choose the slope.' }),
  mount_orientation: z.enum(['flat', 'upright', 'tilted'], { error: 'Choose the mount orientation.' }),
  battery_condition: z.enum(['full', 'medium', 'low'], { error: 'Choose the battery condition.' }),
  movement: rcMovementSchema, intensity: rcIntensitySchema,
  consent: z.boolean().refine(Boolean, 'Agree to motion recording before continuing.'),
}).superRefine((value, context) => {
  if (needsIntensity(value.movement) ? value.intensity === 'not_applicable' : value.intensity !== 'not_applicable')
    context.addIssue({ code: 'custom', path: ['intensity'], message: 'Choose an intensity that matches the movement.' });
});

// Mirrors StoreRcResearchTrialRequest; the dynamic end bound is also enforced by
// RcResearchService against the actual capture. Database ownership remains server-only.
export const rcTrialReviewSchema = (durationMs: number) => z.object({
  observed_movement: rcMovementSchema, observed_intensity: rcIntensitySchema,
  label_status: z.enum(['confirmed', 'uncertain'], { error: 'Choose the label certainty.' }),
  quality: z.enum(['usable', 'interrupted', 'mount_disturbed'], { error: 'Choose the recording quality.' }),
  event_start_ms: z.number({ error: 'Enter the event start.' }).int().min(0).max(86400000),
  event_end_ms: z.number({ error: 'Enter the event end.' }).int().min(1).max(Math.min(86400000, Math.floor(durationMs))),
  notes: z.string().trim().max(500, 'Use at most 500 characters.').optional(),
}).superRefine((value, context) => {
  if (value.event_end_ms <= value.event_start_ms) context.addIssue({ code: 'custom', path: ['event_end_ms'], message: 'Event end must be after its start.' });
  if (needsIntensity(value.observed_movement) ? value.observed_intensity === 'not_applicable' : value.observed_intensity !== 'not_applicable')
    context.addIssue({ code: 'custom', path: ['observed_intensity'], message: 'Choose an intensity that matches the movement.' });
});

export type RcSessionSetupInput = z.infer<typeof rcSessionSetupSchema>;
export type RcTrialReviewInput = z.infer<ReturnType<typeof rcTrialReviewSchema>>;
export type RcMovement = z.infer<typeof rcMovementSchema>;
export type RcIntensity = z.infer<typeof rcIntensitySchema>;
