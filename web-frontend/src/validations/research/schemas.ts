import { z } from "zod";

export const researchQuerySchema = z.object({
  page: z.number().int().min(1).optional(),
  per_page: z.number().int().min(1).max(10).optional(),
  search: z.string().max(100).nullable().optional(),
  label_status: z.enum(["confirmed", "uncertain"]).optional(),
});

export type ResearchQuery = z.infer<typeof researchQuerySchema>;
