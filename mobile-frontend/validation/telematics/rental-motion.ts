import { z } from 'zod';
export const rentalMotionConsentSchema = z.object({
  client_session_id: z.string().uuid(),
  consent_version: z.literal('rental-rc-motion-v1'),
  consent: z.literal(true),
  same_mount_confirmed: z.literal(true),
});
export type RentalMotionConsent = z.infer<typeof rentalMotionConsentSchema>;
