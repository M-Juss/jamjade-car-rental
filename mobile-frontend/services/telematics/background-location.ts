import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

export const BACKGROUND_LOCATION_READINESS_TASK = 'jamjade-telematics-background-location-readiness';

// This definition is deliberately inert. It makes the native task infrastructure
// available for a later active-trip phase without registering location updates,
// collecting data, creating trips, or uploading any locations during setup.
if (Platform.OS === 'android' && !TaskManager.isTaskDefined(BACKGROUND_LOCATION_READINESS_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_READINESS_TASK, async () => undefined);
}

export async function getBackgroundLocationReadiness() {
  const [backgroundPermission, backgroundLocationAvailable, taskManagerAvailable] = await Promise.all([
    Location.getBackgroundPermissionsAsync(),
    Location.isBackgroundLocationAvailableAsync(),
    TaskManager.isAvailableAsync(),
  ]);

  return {
    permissionState: backgroundPermission.granted ? 'granted' : backgroundPermission.status === 'denied' ? 'denied' : 'unavailable',
    canAskAgain: backgroundPermission.canAskAgain,
    backgroundLocationAvailable,
    taskManagerAvailable,
    taskDefined: Platform.OS === 'android' && TaskManager.isTaskDefined(BACKGROUND_LOCATION_READINESS_TASK),
    platform: Platform.OS,
    checkedAt: new Date().toISOString(),
  } as const;
}

export async function requestBackgroundLocationAccess() {
  const foregroundPermission = await Location.getForegroundPermissionsAsync();
  if (!foregroundPermission.granted) {
    return {
      ...(await getBackgroundLocationReadiness()),
      permissionState: 'denied' as const,
      reason: 'Foreground location permission must be granted first.',
    };
  }

  await Location.requestBackgroundPermissionsAsync();
  return getBackgroundLocationReadiness();
}
