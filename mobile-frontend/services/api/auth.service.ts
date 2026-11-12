import { Platform } from 'react-native';
import { nativeRecorder } from '@/services/telematics/native-recorder';
import { mapUserProfile } from './profile-mapping';

import {
  apiGet,
  apiPost,
  persistApiAuthToken,
  removeApiAuthToken,
  restoreApiAuthToken,
} from '@/services/http';

import type {
  MobileAuthResponse,
  MobileCurrentUserResponse,
  MobileLoginPayload,
  MobileRegistrationPending,
  MobileRegistrationResendPayload,
  MobileRegistrationVerifyPayload,
  MobileRegisterPayload,
} from './types';

const DEFAULT_DEVICE_NAME = `jamjade-${Platform.OS}`;
const REGISTRATION_EMAIL_RESPONSE_TIMEOUT_MS = 60_000;

export type PasswordResetPending = { resetId: string; expiresAt: string; resendAvailableAt: string };

export async function requestPasswordReset(email: string) {
  const response = await apiPost<PasswordResetPending>('/mobile/password-reset', { email }, { skipAuth: true, allowNetworkFallback: true, responseTimeoutMs: REGISTRATION_EMAIL_RESPONSE_TIMEOUT_MS });
  return response.data;
}

export async function verifyPasswordReset(resetId: string, code: string) {
  const response = await apiPost<{ resetToken: string }>('/mobile/password-reset/verify', { reset_id: resetId, code }, { skipAuth: true, allowNetworkFallback: true });
  return response.data.resetToken;
}

export async function completePasswordReset(resetId: string, resetToken: string, password: string, confirmation: string) {
  await apiPost<null>('/mobile/password-reset/complete', { reset_id: resetId, reset_token: resetToken, password, password_confirmation: confirmation }, { skipAuth: true, allowNetworkFallback: true });
}

export async function login(payload: MobileLoginPayload) {
  await nativeRecorder.lock();
  const response = await apiPost<MobileAuthResponse>('/mobile/login', {
    ...payload,
    device_name: payload.device_name ?? DEFAULT_DEVICE_NAME,
  }, {
    allowNetworkFallback: true,
    skipAuth: true,
  });

  await persistApiAuthToken(response.data.token);

  return { ...response.data, user: mapUserProfile(response.data.user) };
}

export async function beginRegistration(payload: MobileRegisterPayload) {
  const response = await apiPost<MobileRegistrationPending>('/mobile/register', {
    ...payload,
    device_name: payload.device_name ?? DEFAULT_DEVICE_NAME,
  }, {
    allowNetworkFallback: true,
    responseTimeoutMs: REGISTRATION_EMAIL_RESPONSE_TIMEOUT_MS,
    skipAuth: true,
  });

  return response.data;
}

export async function verifyRegistration(payload: MobileRegistrationVerifyPayload) {
  const response = await apiPost<MobileAuthResponse>('/mobile/register/verify', payload, {
    allowNetworkFallback: true,
    skipAuth: true,
  });

  await persistApiAuthToken(response.data.token);

  return { ...response.data, user: mapUserProfile(response.data.user) };
}

export async function resendRegistrationCode(payload: MobileRegistrationResendPayload) {
  const response = await apiPost<MobileRegistrationPending>('/mobile/register/resend', payload, {
    allowNetworkFallback: true,
    responseTimeoutMs: REGISTRATION_EMAIL_RESPONSE_TIMEOUT_MS,
    skipAuth: true,
  });

  return response.data;
}

export async function getCurrentUser() {
  const response = await apiGet<MobileCurrentUserResponse>('/mobile/me');

  return mapUserProfile(response.data.user);
}

export function restoreSession() {
  return restoreApiAuthToken();
}

export async function logout({ revokeRemoteToken = true } = {}) {
  // Stop/lock local capture before any network request or account transition.
  try { await nativeRecorder.lock(); } catch {
    // Native lock revokes its capture permit before file cleanup; local credentials must still clear.
  }
  try {
    if (revokeRemoteToken) {
      await apiPost<null>('/mobile/logout');
    }
  } catch {
    // A local sign-out must still complete when the token is expired or offline.
  } finally {
    await removeApiAuthToken();
  }
}
