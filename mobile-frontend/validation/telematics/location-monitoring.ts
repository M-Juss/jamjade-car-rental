import { z } from 'zod';

export type LocationMonitoringPolicy = {
  consentVersion: number;
  uploadIntervalSeconds: number;
  maximumAccuracyMeters: number;
  maximumAgeSeconds: number;
  futureSkewSeconds: number;
  retentionHours: number;
};

// LatestLocationRequest; native timestamps use ISO 8601 for Laravel's date rule.
export function latestLocationSchema(policy: LocationMonitoringPolicy) {
  return z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().min(0).max(policy.maximumAccuracyMeters),
    captured_at: z.string().refine((value) => Number.isFinite(Date.parse(value)), 'A valid location timestamp is required.'),
  });
}

// Laravel boolean+accepted accepts true, 1 and "1". The consent button sends true.
export const locationConsentSchema = z.object({
  consent: z.union([z.literal(true), z.literal(1), z.literal('1')]),
  consent_version: z.number().int().min(1),
  sharing_mode: z.enum(['foreground', 'foreground_background']),
});
export type LocationConsentInput = z.infer<typeof locationConsentSchema>;

export const locationConsentSchemaFor = (version: number) => locationConsentSchema.extend({ consent_version: z.literal(version) });

export function startLocationMonitoringSchema(policy: LocationMonitoringPolicy) {
  return latestLocationSchema(policy).extend({
    ...locationConsentSchemaFor(policy.consentVersion).shape,
  });
}

export const pauseLocationMonitoringSchema = z.object({ session_token: z.string().length(64), reason: z.enum(['manual', 'interrupted']).optional() });
export function updateLatestLocationSchema(policy: LocationMonitoringPolicy) {
  return latestLocationSchema(policy).extend({ session_token: pauseLocationMonitoringSchema.shape.session_token });
}

export type LatestLocationFix = { latitude: number; longitude: number; accuracy: number; captured_at: string };
