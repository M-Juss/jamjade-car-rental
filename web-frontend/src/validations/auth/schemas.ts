import { z } from "zod/v3";

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
