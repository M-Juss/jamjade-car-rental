import { z } from "zod/v3";

export const bookingDecisionSchema = z.object({
  reason: z.string().trim().min(1, "Enter a reason.").refine((value) => Array.from(value).length <= 1000, "Use 1,000 characters or fewer."),
});
export const noShowSchema = bookingDecisionSchema.extend({ confirmed: z.literal(true) });
export type BookingDecisionValues = z.infer<typeof bookingDecisionSchema>;
