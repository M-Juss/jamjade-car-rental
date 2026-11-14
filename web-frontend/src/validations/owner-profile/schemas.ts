import { z } from "zod";

const requiredMessage = "This field is required.";
const currentPassword = z.string().min(1, requiredMessage);

export const emailSchema = z.object({
  email: z.string().trim().min(1, requiredMessage).email("Enter a valid email address.").max(255, "Maximum 255 characters only."),
  currentPassword,
});
export const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the six-digit code.") });
export const passwordSchema = z.object({
  currentPassword,
  password: z.string()
    .min(1, requiredMessage)
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Use 72 characters or fewer.")
    .refine(value => /\p{Lu}/u.test(value), "Password must contain at least 1 uppercase letter.")
    .refine(value => /[^\p{L}\p{N}\s]/u.test(value), "Password must contain at least 1 special character.")
    .refine(value => new TextEncoder().encode(value).length <= 72, "The password must be 72 UTF-8 bytes or fewer."),
  confirmation: z.string().min(1, requiredMessage),
}).refine(value => value.password === value.confirmation, { path: ["confirmation"], message: "Passwords do not match." })
  .refine(value => value.password !== value.currentPassword, { path: ["password"], message: "Choose a different password." });
