import { z } from "zod/v3";

const REQUIRED_MESSAGE = "This field is required.";
const requiredText = z.string().trim().min(1, REQUIRED_MESSAGE);
const personNamePattern = /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u;
const mobileNumberPattern = /^09\d{9}$/;
const specialCharacterPattern = /[^\p{L}\p{N}\s]/u;

const personName = (field: string) =>
  z.string().transform((value) => value.trim().replace(/\s+/gu, " ")).pipe(requiredText
    .max(80, "Maximum 80 characters only.")
    .regex(
      personNamePattern,
      `${field} may contain letters, spaces, apostrophes, or hyphens, but no numbers.`,
    ));

export function createPersonnelAccountSchema(requirePassword: boolean) {
  return z
    .object({
      firstName: personName("First name"),
      lastName: personName("Last name"),
      email: requiredText
        .email("Enter a valid email address.")
        .max(160, "Maximum 160 characters only."),
      phoneNumber: z
        .string()
        .trim()
        .refine(
          (value) => value === "" || mobileNumberPattern.test(value),
          "Enter an 11-digit mobile number starting with 09.",
        ),
      role: z.enum(["staff", "driver", "admin"]),
      status: z.enum(["active", "inactive"]),
      password: z.string().max(72, "Use 72 characters or fewer."),
      passwordConfirmation: z.string().max(72, "Use 72 characters or fewer."),
    })
    .superRefine((values, context) => {
      if (requirePassword && !values.password) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Password is required.",
          path: ["password"],
        });
      }

      if (values.password && values.password.length < 8) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Password must be at least 8 characters.",
          path: ["password"],
        });
      }

      if (values.password && !/\p{Lu}/u.test(values.password)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Password must contain at least 1 uppercase letter.",
          path: ["password"],
        });
      }

      if (
        values.password &&
        !specialCharacterPattern.test(values.password)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Password must contain at least 1 special character.",
          path: ["password"],
        });
      }

      if (values.password && new TextEncoder().encode(values.password).byteLength > 72) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "The password must be 72 UTF-8 bytes or fewer.",
          path: ["password"],
        });
      }

      if (values.password !== values.passwordConfirmation) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Passwords do not match.",
          path: ["passwordConfirmation"],
        });
      }
    });
}

export type PersonnelAccountFormValues = z.infer<
  ReturnType<typeof createPersonnelAccountSchema>
>;

export function sanitizePersonName(value: string) {
  return value.replace(/[^\p{L}\p{M} '\u2019-]/gu, "").slice(0, 80);
}

export function sanitizeMobileNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export const personnelPhotoSchema = z.custom<File>((value) => value instanceof File && ["image/jpeg", "image/png", "image/webp"].includes(value.type) && value.size <= 5 * 1024 * 1024, "Choose a JPEG, PNG or WebP image under 5 MB.");
