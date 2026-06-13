import { z } from "zod";

import type {
  BasicCustomerProfileInput,
  CustomerDocumentId,
  CustomerDocumentUploads,
  EmergencyContact,
} from "@/types/customer";
import { calculateAge, isFutureDate } from "@/utils/calculateAge";

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

type ZodIssueLike = {
  message: string;
  path: PropertyKey[];
};

type ValidationResult<TData, TField extends string> = {
  data: TData | null;
  errors: FieldErrors<TField>;
};

export type LoginField = "email" | "password";

export type RegisterField = "email" | "password" | "confirmPassword";

export type BasicInfoField =
  | "firstName"
  | "lastName"
  | "contactNumber"
  | "birthdate"
  | "address";

export type EmergencyContactField = "name" | "contactNumber" | "relationship";

export type DocumentVerificationField =
  | "driverLicenseNumber"
  | "driverLicenseExpirationDate"
  | "driverLicenseFront"
  | "driverLicenseBack"
  | "proofOfAddress"
  | "passport";

export type BookingFormField =
  | "rentalDate"
  | "returnDate"
  | "pickupLocation"
  | "deliveryTime"
  | "returnLocation"
  | "driverOption";

export type BookingValidationInput = {
  rentalDate: string;
  returnDate: string;
  pickupOption: "shop" | "delivery";
  pickupLocation: string;
  deliveryTime: string;
  returnLocation: string;
  driverOption: "self_drive" | "owners_driver";
  ownerDriverCoverage: "metro_manila" | "outside_manila";
  numberOfDays: number;
  canSelfDrive: boolean;
  selfDriveMessage: string;
};

export function isValidPhoneNumber(value: string) {
  return /^09\d{9}$/.test(value);
}

export function sanitizePersonName(value: string) {
  return value.replace(/[^\p{L} ]/gu, '').slice(0, 100);
}

export function sanitizePhoneNumber(value: string) {
  return value.replace(/\D/g, '').slice(0, 11);
}

function requiredString(message: string) {
  return z.string().trim().min(1, { message });
}

function getFieldErrors<TField extends string>(issues: ZodIssueLike[]) {
  const errors: FieldErrors<TField> = {};

  issues.forEach((issue) => {
    const field = issue.path[0];

    if (typeof field === "string" && !errors[field as TField]) {
      errors[field as TField] = issue.message;
    }
  });

  return errors;
}

function buildValidationResult<TData, TField extends string>(
  result:
    | { success: true; data: TData }
    | { success: false; error: { issues: ZodIssueLike[] } },
): ValidationResult<TData, TField> {
  if (result.success) {
    return { data: result.data, errors: {} };
  }

  return {
    data: null,
    errors: getFieldErrors<TField>(result.error.issues),
  };
}

const phoneSchema = requiredString("Contact number is required.").refine(
  isValidPhoneNumber,
  {
    message: "Enter an 11-digit mobile number starting with 09.",
  },
);

const personNameSchema = (field: string) =>
  requiredString(`${field} is required.`).regex(/^[\p{L} ]+$/u, {
    message: `${field} may only contain letters and spaces.`,
  });

export const loginSchema = z.object({
  email: requiredString("Email address is required.").email(
    "Enter a valid email address.",
  ),
  password: z.string().min(1, { message: "Enter your password." }),
});

export const registerSchema = z
  .object({
    email: requiredString("Email address is required.").email(
      "Enter a valid email address.",
    ),
    password: z
      .string()
      .min(8, { message: "Use at least 8 characters with 1 uppercase letter and 1 special character." })
      .regex(/[A-Z]/, { message: "Include at least 1 uppercase letter." })
      .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, {
        message: "Include at least 1 special character.",
      }),
    confirmPassword: z.string().min(1, { message: "Confirm your password." }),
  })
  .superRefine((form, context) => {
    if (form.password !== form.confirmPassword) {
      context.addIssue({
        code: "custom",
        message: "Password and confirm password must match.",
        path: ["confirmPassword"],
      });
    }
  });

export const basicInfoSchema = z.object({
  address: requiredString("Address is required."),
  birthdate: z
    .string()
    .min(1, { message: "Birthdate is required." })
    .refine((value) => !isFutureDate(value), {
      message: "Birthdate cannot be in the future.",
    })
    .refine(
      (value) => {
        const age = calculateAge(value);

        return age !== null && age >= 0;
      },
      {
        message: "Choose a valid birthdate.",
      },
    ),
  contactNumber: phoneSchema,
  firstName: personNameSchema("First name"),
  lastName: personNameSchema("Last name"),
  profilePicture: z.string(),
});

export const emergencyContactSchema = z
  .object({
    contactNumber: z.string(),
    name: z.string(),
    relationship: z.enum([
      "Parent",
      "Sibling",
      "Spouse",
      "Guardian",
      "Friend",
      "Other",
      "",
    ]),
  })
  .superRefine((contact, context) => {
    if (!contact.name.trim()) {
      context.addIssue({
        code: "custom",
        message: "Emergency contact name is required.",
        path: ["name"],
      });
    } else if (!/^[\p{L} ]+$/u.test(contact.name)) {
      context.addIssue({
        code: "custom",
        message: "Emergency contact name may only contain letters and spaces.",
        path: ["name"],
      });
    }

    if (!contact.contactNumber.trim()) {
      context.addIssue({
        code: "custom",
        message: "Emergency contact number is required.",
        path: ["contactNumber"],
      });
    } else if (!isValidPhoneNumber(contact.contactNumber)) {
      context.addIssue({
        code: "custom",
        message: "Enter an 11-digit mobile number starting with 09.",
        path: ["contactNumber"],
      });
    }

    if (!contact.relationship) {
      context.addIssue({
        code: "custom",
        message: "Select a relationship.",
        path: ["relationship"],
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
        message: "Expiration date must be in the future.",
      }),
    driverLicenseFront: requiredString(
      "Upload the driver's license front image.",
    ),
    driverLicenseNumber: requiredString("Driver's license number is required."),
    passport: z.string(),
    passportRequiredByAdmin: z.boolean(),
    proofOfAddress: requiredString("Upload proof of address or Meralco bill."),
  })
  .superRefine((form, context) => {
    if (form.passportRequiredByAdmin && !form.passport.trim()) {
      context.addIssue({
        code: "custom",
        message: "Passport upload is required by admin.",
        path: ["passport"],
      });
    }
  });

const driverLicenseDocumentSchema = z.object({
  driverLicenseBack: requiredString("Upload the driver's license back image."),
  driverLicenseExpirationDate: z
    .string()
    .min(1, { message: "Driver's license expiration date is required." })
    .refine(isFutureDate, {
      message: "Expiration date must be in the future.",
    }),
  driverLicenseFront: requiredString(
    "Upload the driver's license front image.",
  ),
  driverLicenseNumber: requiredString("Driver's license number is required."),
});

const passportDocumentSchema = z.object({
  passport: requiredString("Upload the passport information page."),
});

const proofOfAddressDocumentSchema = z.object({
  proofOfAddress: requiredString("Upload a Meralco bill or proof of address."),
});

export const bookingFormSchema = z
  .object({
    canSelfDrive: z.boolean(),
    driverOption: z.enum(["self_drive", "owners_driver"]),
    numberOfDays: z.number(),
    ownerDriverCoverage: z.enum(["metro_manila", "outside_manila"]),
    deliveryTime: z.string(),
    pickupLocation: z.string(),
    pickupOption: z.enum(["shop", "delivery"]),
    returnLocation: z.string(),
    rentalDate: z.string().min(1, { message: "Rental date is required." }),
    returnDate: z.string().min(1, { message: "Return date is required." }),
    selfDriveMessage: z.string(),
  })
  .superRefine((form, context) => {
    const rentalTimestamp = Date.parse(form.rentalDate);
    const returnTimestamp = Date.parse(form.returnDate);
    const hasRentalDate = Boolean(form.rentalDate);
    const hasReturnDate = Boolean(form.returnDate);
    const hasValidRentalDate = hasRentalDate && !Number.isNaN(rentalTimestamp);
    const hasValidReturnDate = hasReturnDate && !Number.isNaN(returnTimestamp);

    if (hasRentalDate && !hasValidRentalDate) {
      context.addIssue({
        code: "custom",
        message: "Rental date must use YYYY-MM-DD.",
        path: ["rentalDate"],
      });
    }

    if (hasReturnDate && !hasValidReturnDate) {
      context.addIssue({
        code: "custom",
        message: "Return date must use YYYY-MM-DD.",
        path: ["returnDate"],
      });
    }

    if (
      hasValidRentalDate &&
      hasValidReturnDate &&
      returnTimestamp <= rentalTimestamp
    ) {
      context.addIssue({
        code: "custom",
        message: "Return date must be after rental date.",
        path: ["returnDate"],
      });
    }

    if (hasValidRentalDate && hasValidReturnDate && form.numberOfDays < 1) {
      context.addIssue({
        code: "custom",
        message: "Number of days must be at least 1.",
        path: ["returnDate"],
      });
    }

    if (form.pickupOption === "delivery" && !form.pickupLocation.trim()) {
      context.addIssue({
        code: "custom",
        message: "Preferred pickup location is required for delivery.",
        path: ["pickupLocation"],
      });
    }

    if (form.driverOption === "self_drive" && form.pickupOption !== "shop") {
      context.addIssue({
        code: "custom",
        message: "Self-drive bookings require shop pickup.",
        path: ["driverOption"],
      });
    }

    if (
      form.driverOption === "owners_driver" &&
      form.pickupOption !== "delivery"
    ) {
      context.addIssue({
        code: "custom",
        message: "Owner's driver bookings require delivery.",
        path: ["driverOption"],
      });
    }

    if (form.driverOption === "owners_driver" && !form.returnLocation.trim()) {
      context.addIssue({
        code: "custom",
        message: "End trip location is required.",
        path: ["returnLocation"],
      });
    }

    if (
      form.pickupOption === "delivery" &&
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.deliveryTime)
    ) {
      context.addIssue({
        code: "custom",
        message: "Choose a valid delivery time.",
        path: ["deliveryTime"],
      });
    }

    if (form.driverOption === "self_drive" && !form.canSelfDrive) {
      context.addIssue({
        code: "custom",
        message: form.selfDriveMessage,
        path: ["driverOption"],
      });
    }
  });

export function validateLogin(form: z.input<typeof loginSchema>) {
  return buildValidationResult<z.output<typeof loginSchema>, LoginField>(
    loginSchema.safeParse(form),
  );
}

export function validateRegister(form: z.input<typeof registerSchema>) {
  return buildValidationResult<z.output<typeof registerSchema>, RegisterField>(
    registerSchema.safeParse(form),
  );
}

export function validateBasicInfo(form: BasicCustomerProfileInput) {
  return buildValidationResult<BasicCustomerProfileInput, BasicInfoField>(
    basicInfoSchema.safeParse(form),
  );
}

export function validateEmergencyContact(contact: EmergencyContact) {
  return buildValidationResult<EmergencyContact, EmergencyContactField>(
    emergencyContactSchema.safeParse(contact),
  );
}

export function validateDocumentVerification(form: CustomerDocumentUploads) {
  return buildValidationResult<
    CustomerDocumentUploads,
    DocumentVerificationField
  >(documentVerificationSchema.safeParse(form));
}

export function validateCustomerDocument(
  documentId: CustomerDocumentId,
  form: CustomerDocumentUploads,
) {
  const result =
    documentId === "driver-license"
      ? driverLicenseDocumentSchema.safeParse(form)
      : documentId === "passport"
        ? passportDocumentSchema.safeParse(form)
        : proofOfAddressDocumentSchema.safeParse(form);

  if (result.success) {
    return {
      errors: {} as FieldErrors<DocumentVerificationField>,
      isValid: true,
    };
  }

  return {
    errors: getFieldErrors<DocumentVerificationField>(result.error.issues),
    isValid: false,
  };
}

export function validateBookingForm(form: BookingValidationInput) {
  return buildValidationResult<BookingValidationInput, BookingFormField>(
    bookingFormSchema.safeParse(form),
  );
}

export function hasErrors<T extends string>(errors: FieldErrors<T>) {
  return (Object.values(errors) as string[]).some(Boolean);
}

export function getFirstError<T extends string>(errors: FieldErrors<T>) {
  return (Object.values(errors) as string[]).find(Boolean) ?? "";
}
