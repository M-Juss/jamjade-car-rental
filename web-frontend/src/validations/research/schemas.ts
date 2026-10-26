import { z } from "zod";

export const researchQuerySchema = z.object({
  page: z.number().int().min(1).optional(),
  per_page: z.number().int().min(1).max(10).optional(),
  search: z.string().max(100).nullable().optional(),
  label_status: z.enum(["confirmed", "uncertain"]).optional(),
});

export type ResearchQuery = z.infer<typeof researchQuerySchema>;

export const nativeResearchQuerySchema = z.object({ page: z.number().int().min(1), per_page: z.number().int().min(1).max(10), search: z.string().max(100) });
export const nativeWindowQuerySchema = z.object({
  channel: z.enum(["accelerometer", "gyroscope", "gravity", "linear_acceleration", "rotation_vector"]),
  start_ms: z.number().min(0).max(86400000), end_ms: z.number().min(0).max(86400000),
}).refine(value => value.end_ms > value.start_ms && value.end_ms - value.start_ms <= 30000, "Select an interval of at most 30 seconds.");
