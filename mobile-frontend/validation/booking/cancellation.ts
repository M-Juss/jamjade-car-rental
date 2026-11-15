import { z } from 'zod';

export const cancelUnpaidBookingSchema = z.object({
  reason: z.string().trim().min(1, 'Enter a cancellation reason.')
    .refine((value) => Array.from(value).length <= 1000, 'Reason must be 1,000 characters or fewer.'),
});

export type CancelUnpaidBookingInput = z.infer<typeof cancelUnpaidBookingSchema>;
