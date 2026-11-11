import { z } from 'zod';

export function isValidPhoneNumber(value: string) {
  return /^09\d{9}$/.test(value);
}

export function sanitizePersonName(value: string) {
  return value.replace(/[^\p{L}\p{M} '\u2019-]/gu, '').slice(0, 100);
}

export function sanitizePhoneNumber(value: string) {
  return value.replace(/\D/g, '').slice(0, 11);
}

export function sanitizeIntegerInput(value: string) {
  return value.replace(/\D/g, '');
}

export function sanitizeDecimalInput(value: string, maxFractionDigits = 2) {
  const unsigned = value.replace(/-/g, '');
  const parts = unsigned.replace(/[^\d.]/g, '').split('.');
  const whole = parts.shift() ?? '';
  const fraction = parts.join('').slice(0, maxFractionDigits);
  return `${whole}${parts.length || unsigned.includes('.') ? `.${fraction}` : ''}`;
}

export function utf8ByteLength(value: string) {
  return Array.from(value).reduce((length, character) => {
    const code = character.codePointAt(0) ?? 0;
    return length + (code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4);
  }, 0);
}

export const accountPasswordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use 72 characters or fewer.')
  .refine((value) => /\p{Lu}/u.test(value), 'Add at least 1 uppercase letter.')
  .refine((value) => /[^\p{L}\p{N}\s]/u.test(value), 'Add at least 1 special character.')
  .refine((value) => utf8ByteLength(value) <= 72, 'The password must be 72 UTF-8 bytes or fewer.');

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
  requiredString(`${field} is required.`).regex(/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u, {
    message: `${field} may contain letters, spaces, apostrophes, or hyphens, but no numbers.`,
  });
