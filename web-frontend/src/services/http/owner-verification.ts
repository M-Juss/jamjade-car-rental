import { OwnerVerificationCancelled } from "./errors";

export class OwnerVerificationWait extends Error {
  constructor(public readonly retryAfter: number) {
    super("Please wait before requesting another code.");
  }
}

export type OwnerVerificationRequest = {
  send: (id?: string) => Promise<{ verificationId?: string; resendAvailableAt?: string; verificationRequired?: boolean }>;
  verify: (id: string, code: string) => Promise<Response>;
  resolve: (response: Response) => void;
  reject: () => void;
};

export function requestOwnerVerification(send: OwnerVerificationRequest["send"], verify: OwnerVerificationRequest["verify"]): Promise<Response> {
  return new Promise((resolve, reject) => {
    window.dispatchEvent(new CustomEvent<OwnerVerificationRequest>("owner-verification", { detail: { send, verify, resolve, reject: () => reject(new OwnerVerificationCancelled()) } }));
  });
}
