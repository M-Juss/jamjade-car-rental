import { z } from "zod/v3";

const REQUIRED_MESSAGE = "This field is required.";
const requiredText = z.string().trim().min(1, REQUIRED_MESSAGE);
const personNamePattern = /^[\p{L} ]+$/u;
const mobileNumberPattern = /^09\d{9}$/;
const specialCharacterPattern =
  /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

const personName = (field: string) =>
  requiredText
    .max(80, "Maximum 80 characters only.")
    .regex(
      personNamePattern,
      `${field} may only contain letters and spaces.`,
    );

export function createAdminAccountSchema(requirePassword: boolean) {
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
      role: requiredText,
      status: z.enum(["active", "inactive"]),
      password: z.string().max(255, "Maximum 255 characters only."),
      passwordConfirmation: z.string().max(255, "Maximum 255 characters only."),
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

      if (values.password && !/[A-Z]/.test(values.password)) {
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

      if (values.password !== values.passwordConfirmation) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Passwords do not match.",
          path: ["passwordConfirmation"],
        });
      }
    });
}

export const adminRoleSchema = z.object({
  name: requiredText.max(80, "Maximum 80 characters only."),
  modules: z.array(z.string()).min(1, "Select at least one module."),
});

export type AdminAccountFormValues = z.infer<
  ReturnType<typeof createAdminAccountSchema>
>;
export type AdminRoleFormValues = z.infer<typeof adminRoleSchema>;

export function sanitizePersonName(value: string) {
  return value.replace(/[^\p{L} ]/gu, "").slice(0, 80);
}

export function sanitizeMobileNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}
