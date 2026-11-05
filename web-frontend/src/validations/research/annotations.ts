import { z } from "zod";

export const movements = ["stationary", "acceleration", "driving", "braking", "left_turn", "right_turn", "swerving", "other"] as const;
export const directions = ["forward", "reverse", "not_applicable", "unknown"] as const;
export const severities = ["normal", "harsh", "not_applicable", "unknown"] as const;
export const certainties = ["reviewed", "uncertain"] as const;
export const annotationSources = ["observed", "operator_report", "signal_review"] as const;

// StoreRcAnnotationsRequest owns acceptance. Duration, access and revision conflicts stay server rules.
export const annotationIntervalSchema = z.object({
  start_ms: z.number().min(0).max(86400000), end_ms: z.number().min(0).max(86400000),
  movement: z.enum(movements), direction: z.enum(directions), severity: z.enum(severities),
  certainty: z.enum(certainties), source: z.enum(annotationSources), notes: z.string().max(1000).nullable(),
}).strict().superRefine((value, ctx) => {
  if (value.end_ms <= value.start_ms) ctx.addIssue({ code: "custom", path: ["start_ms"], message: "End must follow start." });
  const stationary = value.movement === "stationary";
  if (stationary && (value.direction !== "not_applicable" || value.severity !== "not_applicable")) {
    ctx.addIssue({ code: "custom", path: ["movement"], message: "Stationary intervals use no driving direction or severity." });
  }
  if (!stationary && (value.direction === "not_applicable" || value.severity === "not_applicable")) {
    ctx.addIssue({ code: "custom", path: ["movement"], message: "Choose a direction and severity, or Unknown." });
  }
  if (value.certainty === "reviewed" && (value.source === "signal_review" || value.direction === "unknown" || value.severity === "unknown")) {
    ctx.addIssue({ code: "custom", path: ["certainty"], message: "Signal-only or unknown assessments must remain uncertain." });
  }
});
export const annotationRevisionSchema = z.object({ base_revision: z.number().int().min(0).max(1000),
  intervals: z.array(annotationIntervalSchema).max(100),
}).superRefine((value, ctx) => {
  let previous = 0;
  value.intervals.forEach((interval, i) => {
    if (interval.start_ms < previous) ctx.addIssue({ code: "custom", path: ["intervals", i, "start_ms"], message: "Use ordered, nonoverlapping intervals." });
    previous = interval.end_ms;
  });
});
export type AnnotationInterval = z.infer<typeof annotationIntervalSchema>;
export type AnnotationValues = z.infer<typeof annotationRevisionSchema>;
