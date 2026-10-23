import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Increment when the disclosure's recording scope or terms materially change.
export const CALIBRATION_DISCLOSURE_VERSION = 2;
export type CalibrationConsentScope = { userId: number; bookingCode: string; profileId: string };
const accepted = new Set<string>();

function scopeKey(scope: CalibrationConsentScope) {
  const encoded = Array.from(JSON.stringify([scope.userId, scope.bookingCode, scope.profileId, CALIBRATION_DISCLOSURE_VERSION]))
    .map((character) => character.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  return `jamjade.calibration.consent.${encoded}`;
}

export async function hasCalibrationConsent(scope: CalibrationConsentScope) {
  const key = scopeKey(scope);
  if (accepted.has(key)) return true;
  try {
    const value = Platform.OS === 'web' ? window.localStorage.getItem(key) : await SecureStore.getItemAsync(key);
    if (value !== 'accepted') return false;
    accepted.add(key);
    return true;
  } catch { return false; }
}

export async function rememberCalibrationConsent(scope: CalibrationConsentScope) {
  const key = scopeKey(scope);
  // Preserve explicit agreement for this runtime if device storage is unavailable.
  accepted.add(key);
  try {
    if (Platform.OS === 'web') window.localStorage.setItem(key, 'accepted');
    else await SecureStore.setItemAsync(key, 'accepted');
  } catch { /* A storage failure never invents agreement after a fresh launch. */ }
}
