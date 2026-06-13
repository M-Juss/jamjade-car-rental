import { z } from "zod/v3";

const personNamePattern = /^[\p{L} ]+$/u;
const mobileNumberPattern = /^09\d{9}$/;
const specialCharacterPattern =
  /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

export const registerSchema = z
  .object({
    fullname: z
      .string()
      .trim()
      .nonempty("Full name is required.")
      .regex(
        personNamePattern,
        "Full name may only contain letters and spaces.",
      ),

    email: z
      .string()
      .trim()
      .nonempty("Email is required.")
      .email("Enter a valid email address.")
      .max(160, "Maximum 160 characters only."),

    contact_number: z
      .string()
      .trim()
      .nonempty("Phone Number is required.")
      .regex(
        mobileNumberPattern,
        "Enter an 11-digit mobile number starting with 09.",
      ),

    address: z.string().trim().nonempty("Address is required."),

    password: z
      .string()
      .nonempty("Password is required.")
      .min(8, "Use at least 8 characters with 1 uppercase letter and 1 special character.")
      .max(255, "Maximum 255 characters only.")
      .regex(/[A-Z]/, "Include at least 1 uppercase letter.")
      .regex(
        specialCharacterPattern,
        "Include at least 1 special character.",
      ),

    password_confirmation: z
      .string()
      .nonempty("Confirm your password.")
      .max(255, "Maximum 255 characters only."),
  })
  .refine((data) => data.password === data.password_confirmation, {
    path: ["password_confirmation"],
    message: "Password and confirm password must match.",
  });

export type RegisterSchemaFormValues = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .nonempty("Email is required.")
    .email("Enter a valid email address.")
    .max(160, "Maximum 160 characters only."),

  password: z
    .string()
    .nonempty("Password is required.")
    .max(255, "Maximum 255 characters only."),
});

export type LoginSchemaFormValues = z.infer<typeof loginSchema>;
