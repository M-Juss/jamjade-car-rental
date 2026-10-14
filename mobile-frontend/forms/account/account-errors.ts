import { ApiError } from '@/services/http';

export function getAccountSaveErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback;
  if (error.status === 422) return 'Please correct the highlighted fields.';
  if (error.status === 429) return 'Too many attempts. Please try again shortly.';
  if (error.status === 0) return 'Check your connection and try again.';
  return error.message;
}
