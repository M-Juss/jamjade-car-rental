import type { MobileTelematicsHandover } from '@/services/api';
import type { Booking } from '@/types/booking';

export const DEVICE_SETUP_STEPS = {
  device_check: { guidance: 'Check that this phone supports motion sensors and location services.', requires: [] },
  motion_permission: { guidance: 'Verify motion access for future supervised calibration. No motion data is collected now.', requires: ['device_check'] },
  location_permission: { guidance: 'Allow location access to check this phone’s setup when you request a check.', requires: ['device_check', 'motion_permission'] },
  background_location: { guidance: 'Verify background permission readiness. Android may open Settings. This does not start tracking.', requires: ['location_permission'] },
  gps_check: { guidance: 'While stationary in an open area, request one fresh GPS fix. Exact setup coordinates are not retained.', requires: ['background_location'] },
  phone_mount: { guidance: 'Park safely and secure the phone upright in the vehicle mount, with the screen facing the driver.', requires: ['gps_check'] },
} as const;

export type DeviceSetupStep = keyof typeof DEVICE_SETUP_STEPS;

export const SETUP_CHECK_ORDER: readonly DeviceSetupStep[] = [
  'device_check',
  'motion_permission',
  'location_permission',
  'background_location',
  'gps_check',
  'phone_mount',
];

export function isDeviceSetupStep(step: string): step is DeviceSetupStep {
  return Object.prototype.hasOwnProperty.call(DEVICE_SETUP_STEPS, step);
}

// This filters navigation choices only. Each selected booking is authorized and
// evaluated again by the handover endpoint; booking state never unlocks checks.
export function canSelectTelematicsBooking(booking: Pick<Booking, 'driverType' | 'status'>) {
  return booking.driverType === 'Self-Drive' && ['Confirmed', 'Active', 'Ongoing'].includes(booking.status);
}

export function missingSetupPrerequisite(handover: MobileTelematicsHandover, step: DeviceSetupStep) {
  if (handover.eligibility.testMode) return undefined;
  return DEVICE_SETUP_STEPS[step].requires.find((required) =>
    !handover.steps.some((item) => item.type === required && item.status === 'passed'),
  );
}

export function handoverStatusCopy(handover: MobileTelematicsHandover) {
  if (handover.setup?.status === 'ready_for_release') {
    return { title: 'Ready for staff release', description: 'Your setup is ready. JamJade staff must use Start Rental to release the vehicle.' };
  }
  const scheduledDate = handover.rentalStartAt
    ? new Date(handover.rentalStartAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium' })
    : 'your scheduled rental date';
  return {
    verification_required: { title: 'Documents need approval', description: 'Submit your required self-drive documents and wait for JamJade to approve them.' },
    waiting_for_confirmation: { title: 'Waiting for confirmation', description: 'JamJade must confirm your booking before vehicle handover.' },
    rental_scheduled: { title: 'Rental scheduled', description: `Staff can begin handover on ${scheduledDate} (Philippine time), once the other requirements are complete.` },
    inspection_required: { title: 'Waiting for outgoing inspection', description: 'JamJade staff must finalize the outgoing vehicle inspection and required signatures.' },
    handover_preparation: { title: 'Preparing your handover', description: 'Wait for staff to start your handover.' },
    handover_in_progress: { title: 'Complete your setup checks', description: handover.eligibility.testMode ? 'Local test handover is active. Checks retain their real results; phone-mount confirmation allows staff to test release.' : 'Staff started your handover. Complete the device checks below while safely parked.' },
    released: { title: 'Rental released', description: 'JamJade has started this rental. Your setup results are now read-only.' },
  }[handover.eligibility.state];
}
