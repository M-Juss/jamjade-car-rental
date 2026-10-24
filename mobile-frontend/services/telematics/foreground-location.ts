import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { LocationMonitoringIssue } from './location-monitoring-session';

export type ForegroundLocationReading = { latitude: number; longitude: number; accuracy: number | null; captured_at: string };

export async function prepareForegroundLocation(isActive: () => boolean) {
  if (Platform.OS !== 'android') throw new LocationMonitoringIssue('Location sharing requires the Android app.');
  if (!isActive()) return;
  if (!await Location.hasServicesEnabledAsync()) throw new LocationMonitoringIssue('Enable location services, then try again.');
  let permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted && permission.canAskAgain && isActive()) permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new LocationMonitoringIssue('Allow location access in device Settings, then try again.', true);
}

export function watchForegroundLocation(intervalSeconds: number, onReading: (reading: ForegroundLocationReading) => void, onError: () => void) {
  if (Platform.OS !== 'android') throw new LocationMonitoringIssue('Location sharing requires the Android app.');
  return Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: intervalSeconds * 1000, distanceInterval: 0 }, (fix) => {
    if (!Number.isFinite(fix.timestamp)) return;
    onReading({ latitude: fix.coords.latitude, longitude: fix.coords.longitude, accuracy: fix.coords.accuracy, captured_at: new Date(fix.timestamp).toISOString() });
  }, () => onError());
}
