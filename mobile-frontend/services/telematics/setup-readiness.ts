import type { TelematicsSetupAttemptEvidence } from '@/services/api';
import type { DeviceSetupStep } from '@/lib/telematics/setup';

import { checkDeviceCapabilities } from './device-readiness';
import { requestBackgroundLocationAccess } from './background-location';
import { getFreshLocationFix, requestForegroundLocation } from './location-readiness';
import { requestMotionAccess } from './motion-readiness';

export async function collectSetupReadiness(step: DeviceSetupStep, phoneMounted?: boolean): Promise<TelematicsSetupAttemptEvidence> {
  if (step === 'device_check') {
    const result = await checkDeviceCapabilities();
    return { accelerometer_available: result.accelerometerAvailable, gyroscope_available: result.gyroscopeAvailable, location_services_available: result.locationServicesAvailable, platform: result.platform, build_context: result.buildContext, checked_at: result.checkedAt };
  }
  if (step === 'motion_permission' || step === 'location_permission') {
    const result = step === 'motion_permission' ? await requestMotionAccess() : await requestForegroundLocation();
    return { permission_state: result.permissionState, can_ask_again: result.canAskAgain, platform: result.platform, checked_at: result.checkedAt };
  }
  if (step === 'background_location') {
    const result = await requestBackgroundLocationAccess();
    return { permission_state: result.permissionState, background_location_available: result.backgroundLocationAvailable, task_manager_available: result.taskManagerAvailable, task_defined: result.taskDefined, platform: result.platform, checked_at: result.checkedAt };
  }
  if (step === 'gps_check') {
    const fix = await getFreshLocationFix();
    return { latitude: fix.latitude, longitude: fix.longitude, accuracy: fix.accuracy, speed: fix.speed, heading: fix.heading, captured_at: fix.capturedAt, location_services_enabled: fix.locationServicesEnabled };
  }
  if (phoneMounted === undefined) throw new Error('Phone mount requires your explicit confirmation.');
  return { confirmed: phoneMounted, checked_at: new Date().toISOString() };
}
