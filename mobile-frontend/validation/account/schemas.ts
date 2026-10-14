import { z } from 'zod';

const currentPasswordSchema = z
  .string()
  .min(1, 'Enter your current password.')
  .refine((value) => value.trim().length > 0, 'Enter your current password.');

function utf8ByteLength(value: string) {
  return Array.from(value).reduce((length, character) => {
    const code = character.codePointAt(0) ?? 0;
    return length + (code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4);
  }, 0);
}

export const updateAccountEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Email address is required.')
    .email('Enter a valid email address.')
    .max(255, 'Email address must be 255 characters or fewer.'),
  currentPassword: currentPasswordSchema,
});

export const changeAccountPasswordSchema = z
  .object({
    currentPassword: currentPasswordSchema,
    password: z
      .string()
      .min(8, 'Use at least 8 characters.')
      .max(72, 'Use 72 characters or fewer.')
      .refine((value) => Array.from(value).length >= 8, 'Use at least 8 characters.')
      .refine((value) => value.trim().length > 0, 'Enter your new password.')
      .refine((value) => utf8ByteLength(value) <= 72, 'The new password must be 72 UTF-8 bytes or fewer.'),
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .superRefine((values, context) => {
    if (values.password === values.currentPassword) {
      context.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'Choose a different password from your current password.',
      });
    }
    if (values.password !== values.confirmPassword) {
      context.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'The new passwords must match.',
      });
    }
  });

export type UpdateAccountEmailInput = z.infer<typeof updateAccountEmailSchema>;
export type ChangeAccountPasswordInput = z.infer<typeof changeAccountPasswordSchema>;
