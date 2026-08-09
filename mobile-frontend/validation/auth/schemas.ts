import { z } from 'zod';

import { requiredString } from '@/validation/shared';

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
    password: z.string().min(8, { message: 'Use at least 8 characters.' }),
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
