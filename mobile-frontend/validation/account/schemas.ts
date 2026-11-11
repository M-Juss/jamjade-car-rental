import { z } from 'zod';
import { accountPasswordSchema } from '@/validation/shared';

const currentPasswordSchema = z
  .string()
  .min(1, 'Enter your current password.')
  .refine((value) => value.trim().length > 0, 'Enter your current password.');

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
    password: accountPasswordSchema.refine((value) => value.trim().length > 0, 'Enter your new password.'),
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
