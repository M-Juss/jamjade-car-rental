export const GENERIC_ERROR_MESSAGE = "Action failed. Please try again.";

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

/** The requester closed owner verification without submitting the action. */
export class OwnerVerificationCancelled extends Error {
  constructor() {
    super("Owner verification cancelled");
    this.name = "OwnerVerificationCancelled";
  }
}
