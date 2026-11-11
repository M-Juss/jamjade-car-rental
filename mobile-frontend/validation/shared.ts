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

export function utf8ByteLength(value: string) {
  return Array.from(value).reduce((length, character) => {
    const code = character.codePointAt(0) ?? 0;
    return length + (code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4);
  }, 0);
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
