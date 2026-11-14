import { z } from "zod/v3";

export const cancellationRefundSchema = z.object({
  amount: z.string().trim().min(1, "Amount is required.")
    .regex(/^\d+(?:\.\d{1,2})?$/, "Use no more than two decimal places.")
    .refine((value) => Number(value) <= 9_999_999.99, "Maximum refund is 9,999,999.99."),
  reason: z.string().trim().min(1, "A decision reason is required.").max(1000),
});
export type CancellationRefundValues = z.infer<typeof cancellationRefundSchema>;

export const recordCancellationRefundSchema = z.object({
  confirmed: z.boolean().refine((value) => value, "Confirm that the money has been returned."),
});
export type RecordCancellationRefundValues = z.infer<typeof recordCancellationRefundSchema>;

export const cancellationReasonSchema = z.object({ reason: z.string().trim().min(1, "Cancellation reason is required.").max(1000) });
export type CancellationReasonValues = z.infer<typeof cancellationReasonSchema>;

export const cancellationWithRefundSchema = (paid: number, refundEnabled: boolean) => cancellationReasonSchema.extend({
  refundMode: z.enum(['full', 'custom']),
  refundAmount: z.string(),
}).superRefine((values, context) => {
  if (!refundEnabled || values.refundMode !== 'custom') return;
  if (!/^\d+(?:\.\d{1,2})?$/.test(values.refundAmount) || Number(values.refundAmount) <= 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['refundAmount'], message: 'Enter an amount greater than zero with up to two decimal places.' });
  } else if (Math.round(Number(values.refundAmount) * 100) > Math.round(paid * 100) || Number(values.refundAmount) > 9_999_999.99) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['refundAmount'], message: 'The refund cannot exceed the amount actually paid.' });
  }
});
export type CancellationWithRefundValues = z.infer<ReturnType<typeof cancellationWithRefundSchema>>;
