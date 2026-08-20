import { z } from 'zod';

import { isPastDate } from '@/utils/calculateAge';

export type BookingValidationInput = {
  rentalDate: string;
  returnDate: string;
  pickupOption: 'shop' | 'delivery';
  pickupLocation: string;
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

    if (
      form.driverOption === 'owners_driver' &&
      form.pickupOption !== 'delivery'
    ) {
      context.addIssue({
        code: 'custom',
        message: "Owner's driver bookings require delivery.",
        path: ['driverOption'],
      });
    }

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.deliveryTime)) {
      context.addIssue({
        code: 'custom',
        message: 'Choose a pickup time.',
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
