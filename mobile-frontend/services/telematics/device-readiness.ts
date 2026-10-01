import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { Accelerometer, Gyroscope } from 'expo-sensors';

export async function checkDeviceCapabilities() {
  const [accelerometerAvailable, gyroscopeAvailable, locationServicesAvailable] = await Promise.all([
    Accelerometer.isAvailableAsync(),
    Gyroscope.isAvailableAsync(),
    Location.hasServicesEnabledAsync(),
  ]);

  return {
    accelerometerAvailable,
    gyroscopeAvailable,
    locationServicesAvailable,
    platform: Platform.OS,
    buildContext: Constants.executionEnvironment,
    checkedAt: new Date().toISOString(),
  };
}
