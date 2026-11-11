import { z } from "zod";

// Mirrors ListDrivingAnalysisRequest; record existence and access remain server rules.
export const drivingAnalysisQuerySchema = z.object({
  search: z.string().trim().max(160).nullable().optional(),
  page: z.number().int().min(1).optional(),
  per_page: z.number().int().min(1).max(100).optional(),
  operator_id: z.coerce.number().int().positive().nullable().optional(),
  vehicle_id: z.coerce.number().int().positive().nullable().optional(),
});
