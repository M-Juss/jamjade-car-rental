import { z } from 'zod';

import type { CustomerDocumentId } from '@/types/customer';
import {
  isValidPhoneNumber,
  personNameSchema,
  phoneSchema,
  requiredString,
} from '@/validation/shared';
import {
  BOOKING_AGE_REQUIREMENT_MESSAGE,
  calculateAge,
  isBookingAgeEligible,
  isFutureDate,
} from '@/utils/calculateAge';

export const basicInfoSchema = z.object({
  address: z.string().max(
    1000,
    'Address must be 1000 characters or fewer.',
  ),
  addressDetails: z
    .object({
      addressLine: requiredString('House or street address is required.').max(
        255,
        'House or street address must be 255 characters or fewer.',
      ),
      barangayCode: requiredString('Barangay is required.'),
      cityMunicipalityCode: requiredString('City or municipality is required.'),
      countryCode: z.string().refine((value) => value === 'PH', {
        message: 'Country is required.',
      }),
      formattedAddress: requiredString('Complete address is required.').max(
        1000,
        'Address must be 1000 characters or fewer.',
      ),
      postalCode: requiredString('Postal code is required.').max(
        20,
        'Postal code must be 20 characters or fewer.',
      ),
      provinceCode: z.string().nullable(),
      regionCode: requiredString('Region is required.'),
    })
    .superRefine((address, context) => {
      if (!address.provinceCode && address.regionCode !== '1300000000') {
        context.addIssue({
          code: 'custom',
          message: 'Province is required.',
          path: ['provinceCode'],
        });
      }
  }),
  birthdate: z
    .string()
    .min(1, { message: 'Birthdate is required.' })
    .refine((value) => !isFutureDate(value), {
      message: 'Birthdate cannot be in the future.',
    })
    .refine(
      (value) => {
        const age = calculateAge(value);

        return age !== null && age >= 0;
      },
      {
        message: 'Choose a valid birthdate.',
      },
    )
    .refine((value) => isBookingAgeEligible(value), {
      message: BOOKING_AGE_REQUIREMENT_MESSAGE,
    }),
  contactNumber: phoneSchema,
  email: requiredString('Email address is required.')
    .email('Enter a valid email address.')
    .max(255, 'Email address must be 255 characters or fewer.'),
  firstName: personNameSchema('First name').max(
    100,
    'First name must be 100 characters or fewer.',
  ),
  lastName: personNameSchema('Last name').max(
    100,
    'Last name must be 100 characters or fewer.',
  ),
  profilePicture: z.string(),
});

export const emergencyContactSchema = z
  .object({
    contactNumber: z.string(),
    name: z.string(),
    relationship: z.enum([
      'Parent',
      'Sibling',
      'Spouse',
      'Guardian',
      'Friend',
      'Other',
      '',
    ]),
  })
  .superRefine((contact, context) => {
    if (!contact.name.trim()) {
      context.addIssue({
        code: 'custom',
        message: 'Emergency contact name is required.',
        path: ['name'],
      });
    } else if (!/^[\p{L} ]+$/u.test(contact.name)) {
      context.addIssue({
        code: 'custom',
        message: 'Emergency contact name may only contain letters and spaces.',
        path: ['name'],
      });
    } else if (contact.name.length > 100) {
      context.addIssue({
        code: 'custom',
        message: 'Emergency contact name must be 100 characters or fewer.',
        path: ['name'],
      });
    }

    if (!contact.contactNumber.trim()) {
      context.addIssue({
        code: 'custom',
        message: 'Emergency contact number is required.',
        path: ['contactNumber'],
      });
    } else if (!isValidPhoneNumber(contact.contactNumber)) {
      context.addIssue({
        code: 'custom',
        message: 'Enter an 11-digit mobile number starting with 09.',
        path: ['contactNumber'],
      });
    }

    if (!contact.relationship) {
      context.addIssue({
        code: 'custom',
        message: 'Select a relationship.',
        path: ['relationship'],
      });
    }
  });

export const documentVerificationSchema = z
  .object({
    driverLicenseBack: requiredString(
      "Upload the driver's license back image.",
    ),
    driverLicenseExpirationDate: z
      .string()
      .min(1, { message: "Driver's license expiration date is required." })
      .refine(isFutureDate, {
        message: 'Expiration date must be in the future.',
      }),
    driverLicenseFront: requiredString(
      "Upload the driver's license front image.",
    ),
    driverLicenseNumber: requiredString(
      "Driver's license number is required.",
    ).max(100, "Driver's license number must be 100 characters or fewer."),
    passport: z.string(),
    passportRequiredByAdmin: z.boolean(),
    proofOfAddress: requiredString(
      'Upload proof of address or Meralco bill.',
    ),
  })
  .superRefine((form, context) => {
    if (form.passportRequiredByAdmin && !form.passport.trim()) {
      context.addIssue({
        code: 'custom',
        message: 'Passport upload is required by admin.',
        path: ['passport'],
      });
    }
  });

const customerDocumentUploadsSchema = z.object({
  driverLicenseBack: z.string(),
  driverLicenseExpirationDate: z.string(),
  driverLicenseFront: z.string(),
  driverLicenseNumber: z.string(),
  passport: z.string(),
  passportRequiredByAdmin: z.boolean(),
  proofOfAddress: z.string(),
});

export function getCustomerDocumentSchema(documentId: CustomerDocumentId) {
  return customerDocumentUploadsSchema.superRefine((form, context) => {
    if (documentId === 'driver-license') {
      if (!form.driverLicenseNumber.trim()) {
        context.addIssue({
          code: 'custom',
          message: "Driver's license number is required.",
          path: ['driverLicenseNumber'],
        });
      } else if (form.driverLicenseNumber.length > 100) {
        context.addIssue({
          code: 'custom',
          message: "Driver's license number must be 100 characters or fewer.",
          path: ['driverLicenseNumber'],
        });
      }

      if (!form.driverLicenseExpirationDate) {
        context.addIssue({
          code: 'custom',
          message: "Driver's license expiration date is required.",
          path: ['driverLicenseExpirationDate'],
        });
      } else if (!isFutureDate(form.driverLicenseExpirationDate)) {
        context.addIssue({
          code: 'custom',
          message: 'Expiration date must be in the future.',
          path: ['driverLicenseExpirationDate'],
        });
      }

      if (!form.driverLicenseFront.trim()) {
        context.addIssue({
          code: 'custom',
          message: "Upload the driver's license front image.",
          path: ['driverLicenseFront'],
        });
      }

      if (!form.driverLicenseBack.trim()) {
        context.addIssue({
          code: 'custom',
          message: "Upload the driver's license back image.",
          path: ['driverLicenseBack'],
        });
      }
    }

    if (documentId === 'passport' && !form.passport.trim()) {
      context.addIssue({
        code: 'custom',
        message: 'Upload the passport information page.',
        path: ['passport'],
      });
    }

    if (documentId === 'proof-of-address' && !form.proofOfAddress.trim()) {
      context.addIssue({
        code: 'custom',
        message: 'Upload a Meralco bill or proof of address.',
        path: ['proofOfAddress'],
      });
    }
  });
}
