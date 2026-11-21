export const GENERIC_ERROR_MESSAGE = "Action failed. Please try again.";

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;
  retryAfter?: number;

  constructor(
    message: string,
    status: number,
    errors?: Record<string, string[]>,
    retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
    this.retryAfter = retryAfter;
  }
}

/** The requester closed owner verification without submitting the action. */
export class OwnerVerificationCancelled extends Error {
  constructor() {
    super("Owner verification cancelled");
    this.name = "OwnerVerificationCancelled";
  }
}

/** Retry-After may contain seconds or an HTTP date. Ignore invalid values. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value?.trim()) return undefined;
  const text = value.trim();
  const seconds = /^\d+$/.test(text) ? Number(text) : (Date.parse(text) - now) / 1000;
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined;
}
