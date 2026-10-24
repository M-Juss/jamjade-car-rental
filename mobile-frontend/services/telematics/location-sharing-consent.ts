import * as SecureStore from 'expo-secure-store';

import type { LocationConsentInput } from '@/validation/telematics/location-monitoring';

export type LocationSharingConsentScope = { userId: number; bookingCode: string };
type SavedChoice = { consent_version: number; sharing_mode: LocationConsentInput['sharing_mode'] };

const accepted = new Map<string, SavedChoice>();

function consentKey(scope: LocationSharingConsentScope, version: number) {
  return `jamjade.location.consent.${scope.userId}.${version}`;
}

function legacyConsentKey(scope: LocationSharingConsentScope, version: number) {
  return `jamjade.location.consent.${scope.userId}.${encodeURIComponent(scope.bookingCode)}.${version}`;
}

async function readChoice(key: string): Promise<SavedChoice | null> {
  const raw = await SecureStore.getItemAsync(key);
  return raw ? JSON.parse(raw) as SavedChoice : null;
}

async function writeChoice(key: string, choice: SavedChoice) {
  const value = JSON.stringify(choice);
  await SecureStore.setItemAsync(key, value);
}

function isValidChoice(choice: SavedChoice | null, version: number): choice is SavedChoice {
  return choice?.consent_version === version && (choice.sharing_mode === 'foreground' || choice.sharing_mode === 'foreground_background');
}

export async function getLocationSharingConsent(scope: LocationSharingConsentScope, version: number): Promise<LocationConsentInput | null> {
  const key = consentKey(scope, version);
  let choice = accepted.get(key);
  if (!choice) {
    try {
      const saved = await readChoice(key);
      if (isValidChoice(saved, version)) {
        choice = saved;
      } else {
        // Upgrade choices saved by the earlier account + booking + version key.
        const legacy = await readChoice(legacyConsentKey(scope, version));
        if (isValidChoice(legacy, version)) {
          choice = legacy;
          await writeChoice(key, legacy);
        }
      }
      if (choice) accepted.set(key, choice);
    } catch { return null; }
  }
  return choice ? { consent: true, consent_version: version, sharing_mode: choice.sharing_mode } : null;
}

export async function rememberLocationSharingConsent(scope: LocationSharingConsentScope, consent: LocationConsentInput) {
  const choice: SavedChoice = { consent_version: consent.consent_version, sharing_mode: consent.sharing_mode };
  const key = consentKey(scope, consent.consent_version);
  accepted.set(key, choice);
  try {
    await writeChoice(key, choice);
  } catch { /* Keep the explicit choice for this runtime if secure storage is unavailable. */ }
}
