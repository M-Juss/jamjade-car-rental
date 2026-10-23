import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { themeColors } from '@/constants/theme';
import type { ForegroundLocationReading } from './foreground-location';
import { LocationMonitoringIssue } from './location-monitoring-session';
import { readRentalBackgroundAccess } from './background-location-access';

export const RENTAL_LOCATION_TASK = 'jamjade-rental-latest-location';

type Receiver = {
  id: number;
  reading: (fix: ForegroundLocationReading) => Promise<void> | void;
  error: () => Promise<void> | void;
};
let receiver: Receiver | null = null;
let generation = 0;
let operations: Promise<unknown> = Promise.resolve();
function serial<T>(action: () => Promise<T>): Promise<T> {
  const result = operations.then(action, action);
  operations = result.catch(() => {});
  return result;
}
async function stopNative() {
  if (await Location.hasStartedLocationUpdatesAsync(RENTAL_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(RENTAL_LOCATION_TASK);
  }
}

// The session and token remain in memory. A cold/headless restart cannot resume consent.
if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(RENTAL_LOCATION_TASK)) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(RENTAL_LOCATION_TASK, async ({ data, error }) => {
    const current = receiver;
    if (!current) { await serial(async () => { if (!receiver) await stopNative(); }).catch(() => {}); return; }
    if (error) { await current.error(); return; }
    if (!Array.isArray(data?.locations)) return;
    const latest = data.locations.reduce<Location.LocationObject | null>((best, fix) =>
      Number.isFinite(fix.timestamp) && (!best || fix.timestamp > best.timestamp) ? fix : best, null);
    if (!latest || receiver !== current) return;
    await current.reading({
      latitude: latest.coords.latitude, longitude: latest.coords.longitude,
      accuracy: latest.coords.accuracy, captured_at: new Date(latest.timestamp).toISOString(),
    });
  });
}

export async function prepareBackgroundCollection(isCurrent: () => boolean) {
  const access = await readRentalBackgroundAccess();
  if (isCurrent() && access.status !== 'ready') {
    throw new LocationMonitoringIssue('Allow background location access first, or choose sharing while the app is open.', access.status === 'foreground_required' || access.status === 'background_required');
  }
}

export async function watchBackgroundLocation(interval: number, reading: Receiver['reading'], error: Receiver['error']) {
  const id = ++generation;
  await serial(async () => {
    if (generation !== id) return;
    await stopNative();
    if (generation !== id) return;
    receiver = { id, reading, error };
    try {
      await Location.startLocationUpdatesAsync(RENTAL_LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: interval * 1000,
        distanceInterval: 0,
        deferredUpdatesInterval: interval * 1000,
        deferredUpdatesDistance: 0,
        showsBackgroundLocationIndicator: true,
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.AutomotiveNavigation,
        foregroundService: {
          notificationTitle: 'JamJade location sharing',
          notificationBody: 'Sharing your latest rental location. Open Telematics to stop.',
          notificationColor: themeColors.primary,
          killServiceOnDestroy: true,
        },
      });
    } catch (failure) {
      if (receiver?.id === id) receiver = null;
      await stopNative().catch(() => {});
      throw failure;
    }
  });
  return { remove() {
    if (receiver?.id === id) receiver = null;
    if (generation === id) generation++;
    void serial(async () => { if (!receiver) await stopNative(); }).catch(() => {});
  } };
}

export function stopBackgroundCollection() {
  receiver = null;
  generation++;
  if (Platform.OS === 'web') return Promise.resolve();
  return serial(stopNative);
}
