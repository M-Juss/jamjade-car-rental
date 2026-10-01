import { Platform } from 'react-native';
import { DeviceMotion } from 'expo-sensors';

function permissionState(permission: { granted: boolean; status: string }) {
  return permission.granted ? 'granted' : permission.status === 'denied' ? 'denied' : 'unavailable';
}

export async function requestMotionAccess() {
  try {
    const permission = await DeviceMotion.requestPermissionsAsync();

    return {
      permissionState: permissionState(permission),
      canAskAgain: permission.canAskAgain,
      platform: Platform.OS,
      checkedAt: new Date().toISOString(),
    } as const;
  } catch {
    return {
      permissionState: 'unavailable' as const,
      canAskAgain: false,
      platform: Platform.OS,
      checkedAt: new Date().toISOString(),
    };
  }
}
