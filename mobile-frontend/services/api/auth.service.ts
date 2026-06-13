import { Platform } from 'react-native';

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
  const response = await apiPost<MobileAuthResponse>('/mobile/login', {
    ...payload,
    device_name: payload.device_name ?? DEFAULT_DEVICE_NAME,
  }, {
    allowNetworkFallback: true,
    skipAuth: true,
  });

  await persistApiAuthToken(response.data.token);

  return response.data;
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

  return response.data;
}

export async function getCurrentUser() {
  const response = await apiGet<MobileCurrentUserResponse>('/mobile/me');

  return response.data.user;
}

export function restoreSession() {
  return restoreApiAuthToken();
}

export async function logout({ revokeRemoteToken = true } = {}) {
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
