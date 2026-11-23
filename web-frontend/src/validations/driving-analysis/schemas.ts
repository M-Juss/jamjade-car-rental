import { z } from "zod";

// Mirrors ListDrivingAnalysisRequest; record existence and access remain server rules.
export const drivingAnalysisQuerySchema = z.object({
  search: z.string().trim().max(160).nullable().optional(),
  page: z.number().int().min(1).optional(),
  per_page: z.number().int().min(1).max(100).optional(),
  operator_id: z.coerce.number().int().positive().nullable().optional(),
  operator_type: z.enum(["customer", "driver"]).nullable().optional(),
  vehicle_id: z.coerce.number().int().positive().nullable().optional(),
  period: z.enum(["day", "week", "month", "year"]).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || value < "1900-01-01") return false;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())
      .filter(part => part.type !== "literal").map(part => part.value).join("-");
    return value <= today;
  }, "Choose a valid date up to today.").optional(),
  graded_only: z.union([z.boolean(), z.literal(0), z.literal(1), z.literal("0"), z.literal("1")]).optional(),
}).superRefine((values, context) => {
  if (values.period !== undefined && values.date === undefined) context.addIssue({ code: "custom", path: ["date"], message: "Choose a report date." });
  if (values.date !== undefined && values.period === undefined) context.addIssue({ code: "custom", path: ["period"], message: "Choose a report period." });
});
