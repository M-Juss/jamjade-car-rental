import { z } from 'zod';

export function isValidPhoneNumber(value: string) {
  return /^09\d{9}$/.test(value);
}

export function sanitizePersonName(value: string) {
  return value.replace(/[^\p{L} ]/gu, '').slice(0, 100);
}

export function sanitizePhoneNumber(value: string) {
  return value.replace(/\D/g, '').slice(0, 11);
}

export function requiredString(message: string) {
  return z.string().trim().min(1, { message });
}

export const phoneSchema = requiredString('Contact number is required.').refine(
  isValidPhoneNumber,
  {
    message: 'Enter an 11-digit mobile number starting with 09.',
  },
);

export const personNameSchema = (field: string) =>
  requiredString(`${field} is required.`).regex(/^[\p{L} ]+$/u, {
    message: `${field} may only contain letters and spaces.`,
  });
