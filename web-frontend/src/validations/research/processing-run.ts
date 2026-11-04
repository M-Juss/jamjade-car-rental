import { z } from "zod";

const interval = z.tuple([z.number().min(0).max(86400000), z.number().min(0).max(86400000)]);
// Mirrors StoreRcProcessingRunRequest. Ownership, source integrity and axis solvability are server checks.
const baseProcessingFields = {
  start_ms: z.number().min(0).max(86400000), end_ms: z.number().min(0).max(86400000),
  cutoff_hz: z.number().int().refine(value => [3, 5, 8].includes(value), "Choose 3, 5 or 8 Hz."),
  confirmed: z.literal(true),
};
const checkWindow = (value: { start_ms: number; end_ms: number }, ctx: z.RefinementCtx) => {
  if (value.end_ms <= value.start_ms || value.end_ms - value.start_ms > 30000) {
    ctx.addIssue({ code: "custom", path: ["end_ms"], message: "Select a window of at most 30 seconds." });
  }
};
export const processingRunSchema = z.object({ ...baseProcessingFields,
  ranges: z.object({ rest: interval, starting: interval, stopping: interval }).strict(),
  reference_run_id: z.never().optional(), same_mount_confirmed: z.never().optional(),
}).superRefine((value, ctx) => {
  checkWindow(value, ctx);
  let previous = value.start_ms;
  for (const phase of ["rest", "starting", "stopping"] as const) {
    const [a, b] = value.ranges[phase];
    if (a < previous || b > value.end_ms || b - a < 500) {
      ctx.addIssue({ code: "custom", path: ["ranges", phase], message: "Use ordered, separate intervals of at least 0.5 seconds within the window." });
    }
    previous = b;
  }
});
export type ProcessingRunValues = z.infer<typeof processingRunSchema>;

export const reuseProcessingRunSchema = z.object({ ...baseProcessingFields,
  reference_run_id: z.string().uuid("Choose a saved forward reference."),
  same_mount_confirmed: z.boolean().refine(value => value, "Confirm that the phone and mount have not changed."),
  ranges: z.never().optional(),
}).superRefine(checkWindow);
export const processingRequestSchema = z.union([processingRunSchema, reuseProcessingRunSchema]);
export type ReuseProcessingRunValues = z.infer<typeof reuseProcessingRunSchema>;
export type ProcessingRequestValues = z.infer<typeof processingRequestSchema>;
