import { z } from "zod/v3";

export const rejectDocumentSchema = z.object({
  rejectionReason: z.string().trim().min(1, "Rejection notes are required.").max(1000, "Use 1,000 characters or fewer."),
});

export type RejectDocumentFormValues = z.infer<typeof rejectDocumentSchema>;
