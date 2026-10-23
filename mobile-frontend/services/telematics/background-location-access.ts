import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { getBackgroundLocationReadiness, requestBackgroundLocationAccess } from './background-location';

export type BackgroundAccess = {
  status: 'ready' | 'foreground_required' | 'background_required' | 'services_disabled' | 'unavailable';
  canAskAgain: boolean;
};

// Permission preparation only. Never obtains a fix or registers a location task.
export async function readRentalBackgroundAccess(): Promise<BackgroundAccess> {
  if ((Platform.OS !== 'android' && Platform.OS !== 'ios')
    || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return { status: 'unavailable', canAskAgain: false };
  }
  if (!await Location.hasServicesEnabledAsync()) return { status: 'services_disabled', canAskAgain: false };
  const readiness = await getBackgroundLocationReadiness();
  if (!readiness.taskManagerAvailable || !readiness.backgroundLocationAvailable || !readiness.taskDefined) {
    return { status: 'unavailable', canAskAgain: false };
  }
  const foreground = await Location.getForegroundPermissionsAsync();
  if (!foreground.granted) return { status: 'foreground_required', canAskAgain: foreground.canAskAgain };
  return {
    status: readiness.permissionState === 'granted' ? 'ready' : 'background_required',
    canAskAgain: readiness.canAskAgain,
  };
}

export async function prepareRentalBackgroundAccess(isCurrent: () => boolean): Promise<BackgroundAccess | null> {
  if (!isCurrent()) return null;
  let state = await readRentalBackgroundAccess();
  if (!isCurrent()) return null;
  if (state.status === 'foreground_required' && state.canAskAgain) {
    await Location.requestForegroundPermissionsAsync();
    if (!isCurrent()) return null;
    state = await readRentalBackgroundAccess();
  }
  if (!isCurrent()) return null;
  if (state.status === 'background_required' && state.canAskAgain) {
    await requestBackgroundLocationAccess();
    if (!isCurrent()) return null;
    state = await readRentalBackgroundAccess();
  }
  return state;
}
