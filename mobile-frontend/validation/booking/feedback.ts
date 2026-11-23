import { z } from 'zod';

export const bookingFeedbackSchema = z.object({
  rating: z.number().int().min(1, 'Select a star rating.').max(5, 'Select up to 5 stars.'),
  comment: z.string().trim().refine(value => Array.from(value).length <= 1000, 'Use 1,000 characters or fewer.').nullable().optional(),
});

export type BookingFeedbackInput = z.infer<typeof bookingFeedbackSchema>;
