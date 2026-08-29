import { ApiError } from '@/services/http';

export function getPaymentErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return 'PayPal checkout could not connect. Please try again.';
    }

    return error.errors
      ? Object.values(error.errors).flat()[0] ?? error.message
      : error.message;
  }

  return error instanceof Error ? error.message : fallback;
}
