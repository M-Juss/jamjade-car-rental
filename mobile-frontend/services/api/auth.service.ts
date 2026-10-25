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
  MobileRegisterPayload,
} from './types';

const DEFAULT_DEVICE_NAME = `jamjade-${Platform.OS}`;

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

export async function register(payload: MobileRegisterPayload) {
  const response = await apiPost<MobileAuthResponse>('/mobile/register', {
    ...payload,
    device_name: payload.device_name ?? DEFAULT_DEVICE_NAME,
  }, {
    allowNetworkFallback: true,
    skipAuth: true,
  });

  await persistApiAuthToken(response.data.token);

  return { ...response.data, user: mapUserProfile(response.data.user) };
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
