import { Platform } from 'react-native';
import * as Location from 'expo-location';

function permissionState(permission: { granted: boolean; status: string }) {
  return permission.granted ? 'granted' : permission.status === 'denied' ? 'denied' : 'unavailable';
}

export async function requestForegroundLocation() {
  const permission = await Location.requestForegroundPermissionsAsync();

  return {
    permissionState: permissionState(permission),
    canAskAgain: permission.canAskAgain,
    platform: Platform.OS,
    checkedAt: new Date().toISOString(),
  } as const;
}

export async function getFreshLocationFix() {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new Error('Location services are disabled. Enable location services and try again.');
  }
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Foreground location permission is required before getting a GPS fix.');
  }
  const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  if (fix.coords.accuracy === null) {
    throw new Error('The device did not provide GPS accuracy. Move to a clearer area and try again.');
  }

  return {
    latitude: fix.coords.latitude,
    longitude: fix.coords.longitude,
    accuracy: fix.coords.accuracy,
    speed: fix.coords.speed,
    heading: fix.coords.heading,
    capturedAt: new Date(fix.timestamp).toISOString(),
    locationServicesEnabled: servicesEnabled,
    platform: Platform.OS,
  };
}
