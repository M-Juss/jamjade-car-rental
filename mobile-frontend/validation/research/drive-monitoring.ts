import { z } from 'zod';

const finiteNumber = z.number().finite();

export const startDriveMonitoringSchema = z.object({
  client_session_id: z.uuid(),
  reference_run_id: z.uuid(),
  research_session_id: z.uuid(),
  mount_version_id: z.uuid(),
  consent_version: z.literal('drive-monitoring-v1'),
  consent: z.literal(true),
  same_mount_confirmed: z.literal(true),
}).strict();

export type StartDriveMonitoring = z.infer<typeof startDriveMonitoringSchema>;

export const driveMonitoringWindowsSchema = z.object({
  version: z.literal('rc-demo-inference-v1'),
  windows: z.array(z.object({
    id: z.string().min(1).max(100),
    features: z.array(finiteNumber).length(35),
  }).strict()).min(1).max(100),
}).strict().superRefine((value, context) => {
  const seen = new Set<string>();
  value.windows.forEach((window, index) => {
    if (seen.has(window.id)) {
      context.addIssue({ code: 'custom', path: ['windows', index, 'id'], message: 'Window identifiers must be unique.' });
    }
    seen.add(window.id);
  });
});

export type DriveMonitoringWindows = z.infer<typeof driveMonitoringWindowsSchema>;

export const driveMonitoringReferenceQuerySchema = z.object({ research_session_id: z.uuid(), mount_version_id: z.uuid() }).strict();
const windowSchema = z.object({
  id: z.string().min(1).max(100), features: z.array(finiteNumber).length(35),
  start_ms: z.number().int().min(0).max(28800000), end_ms: z.number().int().min(1).max(28800000),
  braking_evidence: z.object({ peak_ms: z.number().int().min(0).max(28800000),
    vertical_peak: finiteNumber.min(0).max(10000), pitch_rate_peak: finiteNumber.min(0).max(10000) }).strict(),
}).strict();
export const driveMonitoringBatchSchema = z.object({ client_batch_id: z.uuid(), version: z.literal('rc-demo-inference-v1'),
  windows: z.array(windowSchema).min(1).max(100),
}).strict().superRefine((value, context) => {
  let previous = -1;
  const ids = new Set<string>();
  value.windows.forEach((w, index) => {
    const peak = w.braking_evidence.peak_ms;
    if (w.start_ms % 20 || w.end_ms % 20 || peak % 20 || ![400,800,1600,3200,5600].includes(w.end_ms-w.start_ms)
      || peak < w.start_ms || peak >= w.end_ms || w.end_ms < previous || w.id !== `w-${w.start_ms}-${w.end_ms}` || ids.has(w.id)) {
      context.addIssue({ code: 'custom', path: ['windows', index], message: 'Use ordered complete monitoring windows.' });
    }
    ids.add(w.id); previous = w.end_ms;
  });
});

export type DriveMonitoringBatch = z.infer<typeof driveMonitoringBatchSchema>;
