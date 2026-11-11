import { z } from 'zod';

import { requiredString, utf8ByteLength } from '@/validation/shared';

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
    password: z
      .string()
      .min(8, { message: 'Use at least 8 characters.' })
      .max(72, 'Use 72 characters or fewer.')
      .refine((value) => utf8ByteLength(value) <= 72, 'The password must be 72 UTF-8 bytes or fewer.'),
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
