import { pauseRentalDriveMonitoring } from './rental-drive-monitoring';
import { AppState } from 'react-native';

import { getLocationMonitoring, pauseLocationMonitoring, startLocationMonitoring, updateLatestLocation } from '@/services/api/location-monitoring.service';
import { prepareForegroundLocation, watchForegroundLocation } from './foreground-location';
import { LocationMonitoringSession } from './location-monitoring-session';
import { getNetworkReadiness } from './network-readiness';
import { prepareBackgroundCollection, stopBackgroundCollection, watchBackgroundLocation } from './background-location-collector';

export const locationMonitoring = new LocationMonitoringSession({
  read: getLocationMonitoring,
  start: startLocationMonitoring,
  update: updateLatestLocation,
  pause: pauseLocationMonitoring,
  prepare: (isCurrent, mode) => mode === 'foreground_background' ? prepareBackgroundCollection(isCurrent) : prepareForegroundLocation(isCurrent),
  watch: (interval, reading, error, mode) => mode === 'foreground_background'
    ? watchBackgroundLocation(interval, reading, error) : watchForegroundLocation(interval, reading, error),
  cleanup: stopBackgroundCollection,
  connected: getNetworkReadiness,
  foreground: () => AppState.currentState === 'active',
  now: Date.now,
});

// Revoked access and account cleanup also stop motion. Explicit user pause is
// coupled in useTelematicsMonitoring. A temporary
// offline state alone does not stop the native feature collector.
locationMonitoring.subscribe(() => {
  const phase = locationMonitoring.getSnapshot().phase;
  if (phase === 'idle' || phase === 'error') void pauseRentalDriveMonitoring().catch(() => {});
});
