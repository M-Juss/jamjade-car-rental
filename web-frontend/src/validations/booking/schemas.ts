import { z } from "zod/v3";

export const assignDriverSchema = z.object({
  driver_id: z.string().trim().min(1, "Select a driver."),
});

export type AssignDriverFormValues = z.infer<typeof assignDriverSchema>;