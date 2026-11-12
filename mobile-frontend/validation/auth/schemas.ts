import { z } from 'zod';

import { accountPasswordSchema, requiredString } from '@/validation/shared';

export const loginSchema = z.object({
  email: requiredString('Email address is required.')
    .email('Enter a valid email address.')
    .max(255, 'Email address must be 255 characters or fewer.'),
  password: z.string().min(1, { message: 'Enter your password.' }),
});

export const registerSchema = z
  .object({
    email: requiredString('Email address is required.')
      .email('Enter a valid email address.')
      .max(255, 'Email address must be 255 characters or fewer.'),
    password: accountPasswordSchema,
    confirmPassword: z.string().min(1, { message: 'Confirm your password.' }),
  })
  .superRefine((form, context) => {
    if (form.password !== form.confirmPassword) {
      context.addIssue({
        code: 'custom',
        message: 'Password and confirm password must match.',
        path: ['confirmPassword'],
      });
    }
  });

export const registrationVerificationSchema = z.object({
  registrationId: z.string().uuid('Registration session is invalid.'),
  code: z.string()
    .length(6, 'Enter the six-digit code.')
    .regex(/^[0-9]{6}$/, 'Enter the six-digit code.'),
});

export const registrationResendSchema = z.object({
  registrationId: z.string().uuid('Registration session is invalid.'),
});

export const passwordResetEmailSchema = z.object({ email: loginSchema.shape.email });
export const passwordResetCodeSchema = z.object({ code: registrationVerificationSchema.shape.code });
export const passwordResetPasswordSchema = z.object({
  password: accountPasswordSchema,
  confirmPassword: z.string().min(1, 'Confirm your password.'),
}).refine((value) => value.password === value.confirmPassword, { path: ['confirmPassword'], message: 'Password and confirm password must match.' });
