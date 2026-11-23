import { z } from "zod/v3";

export const featureFeedbackSchema = z.object({ is_featured: z.boolean() });
export type FeatureFeedbackInput = z.infer<typeof featureFeedbackSchema>;
