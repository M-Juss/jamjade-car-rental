import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { clearApiAuthToken, setApiAuthToken } from './auth-token';

const AUTH_TOKEN_KEY = 'jamjade.mobile.auth_token';

function getWebStorage() {
  return typeof window !== 'undefined' ? window.localStorage : null;
}

export async function persistApiAuthToken(token: string) {
  setApiAuthToken(token);

  try {
    if (Platform.OS === 'web') {
      getWebStorage()?.setItem(AUTH_TOKEN_KEY, token);
      return;
    }

    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
  } catch {
    // Keep the in-memory token so a successful login or registration is not
    // reported as failed when secure persistence is temporarily unavailable.
  }
}

export async function restoreApiAuthToken() {
  const token = Platform.OS === 'web'
    ? getWebStorage()?.getItem(AUTH_TOKEN_KEY) ?? null
    : await SecureStore.getItemAsync(AUTH_TOKEN_KEY);

  setApiAuthToken(token);

  return token;
}

export async function removeApiAuthToken() {
  clearApiAuthToken();

  if (Platform.OS === 'web') {
    getWebStorage()?.removeItem(AUTH_TOKEN_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}
