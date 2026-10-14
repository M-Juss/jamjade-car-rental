import { z } from 'zod';
export const deliveryRoutesSchema = z
  .object({
    vehicleId: z
      .string()
      .refine(
        (v) => Number.isInteger(Number(v)) && Number(v) > 0,
        'Select a vehicle.',
      ),
    rentalStartAt: z
      .string()
      .refine(
        (v) => Number.isFinite(Date.parse(v)) && Date.parse(v) > Date.now(),
        'Choose a future pickup date and time.',
      ),
    rentalEndAt: z
      .string()
      .refine((v) => Number.isFinite(Date.parse(v)), 'Choose a return date.'),
    ownerDriverCoverage: z.enum(['metro_manila', 'outside_manila']),
    address: z.string().trim().min(1, 'Choose an address.').max(255),
    placeId: z.string().max(255).nullable(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    pointConfirmed: z
      .boolean()
      .refine((v) => v, 'Confirm the delivery map point.'),
  })
  .refine((v) => Date.parse(v.rentalEndAt) > Date.parse(v.rentalStartAt), {
    path: ['rentalEndAt'],
    message: 'Return must be after pickup.',
  });
export type DeliveryRoutesValues = z.infer<typeof deliveryRoutesSchema>;
