import { z } from 'zod';

import { isPastDate } from '@/utils/calculateAge';
import { isFuturePickupTime } from '@/lib/browse/pickup-time';

export type BookingValidationInput = {
  rentalDate: string;
  returnDate: string;
  pickupOption: 'shop' | 'delivery';
  pickupLocation: string;
  notes?: string | null;
  deliveryTime: string;
  driverOption: 'self_drive' | 'owners_driver';
  ownerDriverCoverage: 'metro_manila' | 'outside_manila';
  numberOfDays: number;
  canSelfDrive: boolean;
  selfDriveMessage: string;
};

export const bookingFormSchema = z
  .object({
    canSelfDrive: z.boolean(),
    driverOption: z.enum(['self_drive', 'owners_driver']),
    numberOfDays: z.number(),
    ownerDriverCoverage: z.enum(['metro_manila', 'outside_manila']),
    deliveryTime: z.string(),
    pickupLocation: z.string(),
    notes: z.string().trim().max(2000, 'Note must be 2,000 characters or fewer.').nullable().optional(),
    pickupOption: z.enum(['shop', 'delivery']),
    rentalDate: z.string().min(1, { message: 'Rental date is required.' }),
    returnDate: z.string().min(1, { message: 'Return date is required.' }),
    selfDriveMessage: z.string(),
  })
  .superRefine((form, context) => {
    const rentalTimestamp = Date.parse(form.rentalDate);
    const returnTimestamp = Date.parse(form.returnDate);
    const hasRentalDate = Boolean(form.rentalDate);
    const hasReturnDate = Boolean(form.returnDate);
    const hasValidRentalDate =
      hasRentalDate && !Number.isNaN(rentalTimestamp);
    const hasValidReturnDate =
      hasReturnDate && !Number.isNaN(returnTimestamp);

    if (hasRentalDate && !hasValidRentalDate) {
      context.addIssue({
        code: 'custom',
        message: 'Rental date must use YYYY-MM-DD.',
        path: ['rentalDate'],
      });
    }

    if (hasValidRentalDate && isPastDate(form.rentalDate)) {
      context.addIssue({
        code: 'custom',
        message: 'Rental date cannot be in the past.',
        path: ['rentalDate'],
      });
    }

    if (hasReturnDate && !hasValidReturnDate) {
      context.addIssue({
        code: 'custom',
        message: 'Return date must use YYYY-MM-DD.',
        path: ['returnDate'],
      });
    }

    if (
      hasValidRentalDate &&
      hasValidReturnDate &&
      returnTimestamp <= rentalTimestamp
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Return date must be after rental date.',
        path: ['returnDate'],
      });
    }

    if (
      hasValidRentalDate &&
      hasValidReturnDate &&
      form.numberOfDays < 1
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Number of days must be at least 1.',
        path: ['returnDate'],
      });
    }

    if (form.pickupOption === 'delivery' && !form.pickupLocation.trim()) {
      context.addIssue({
        code: 'custom',
        message: 'Preferred pickup location is required for delivery.',
        path: ['pickupLocation'],
      });
    } else if (form.pickupLocation.length > 255) {
      context.addIssue({
        code: 'custom',
        message: 'Pickup location must be 255 characters or fewer.',
        path: ['pickupLocation'],
      });
    }

    if (form.driverOption === 'self_drive' && form.pickupOption !== 'shop') {
      context.addIssue({
        code: 'custom',
        message: 'Self-drive bookings require shop pickup.',
        path: ['driverOption'],
      });
    }


    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.deliveryTime)) {
      context.addIssue({
        code: 'custom',
        message: 'Choose a pickup time.',
        path: ['deliveryTime'],
      });
    } else if (hasValidRentalDate && !isFuturePickupTime(form.rentalDate, form.deliveryTime)) {
      context.addIssue({
        code: 'custom',
        message: 'Choose a pickup time later than the current time.',
        path: ['deliveryTime'],
      });
    }

    if (form.driverOption === 'self_drive' && !form.canSelfDrive) {
      context.addIssue({
        code: 'custom',
        message: form.selfDriveMessage,
        path: ['driverOption'],
      });
    }
  });

export const bookingTermsSchema = z.object({
  signature: z.string().trim().min(1, 'Signature is required.'),
  lateReturnPolicyVersion: z.string().length(64, 'Reload the vehicle and review the current late return terms.'),
});


export const bookingReviewedPricingSchema = z.object({
  pricePerDay: z.number().min(0), subtotal: z.number().min(0), deliveryFee: z.number().min(0),
  deliveryTollFee: z.number().min(0), ownerDriverFee: z.number().min(0), totalAmount: z.number().min(0),
});
