import * as SecureStore from 'expo-secure-store';

import { clearApiAuthToken, setApiAuthToken } from './auth-token';

const AUTH_TOKEN_KEY = 'jamjade.mobile.auth_token';

export async function persistApiAuthToken(token: string) {
  setApiAuthToken(token);

  try {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
  } catch {
    // Keep the in-memory token so a successful login or registration is not
    // reported as failed when secure persistence is temporarily unavailable.
  }
}

export async function restoreApiAuthToken() {
  const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);

  setApiAuthToken(token);

  return token;
}

export async function removeApiAuthToken() {
  clearApiAuthToken();

  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}
