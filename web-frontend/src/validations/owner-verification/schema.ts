import { z } from "zod";

export const ownerVerificationSchema = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the six-digit code.") });
export type OwnerVerificationValues = z.infer<typeof ownerVerificationSchema>;
