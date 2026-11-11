import type { MobileTelematicsHandover } from '@/services/api';
import type { Booking } from '@/types/booking';

export const DEVICE_SETUP_STEPS = {
  device_check: { guidance: 'Check that this phone supports motion sensors and location services.', requires: [] },
  motion_permission: { guidance: 'Verify motion access for future supervised calibration. No motion data is collected now.', requires: ['device_check'] },
  location_permission: { guidance: 'Allow location access to check this phone’s setup when you request a check.', requires: ['device_check', 'motion_permission'] },
  background_location: { guidance: 'Verify background permission readiness. Android may open Settings. This does not start tracking.', requires: ['location_permission'] },
  gps_check: { guidance: 'While stationary in an open area, request one fresh GPS fix. Exact setup coordinates are not retained.', requires: ['background_location'] },
  phone_mount: { guidance: 'Park safely and secure the phone in a fixed vehicle mount.', requires: ['gps_check'] },
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

export function deviceSetupProgress(handover: MobileTelematicsHandover) {
  const passed = SETUP_CHECK_ORDER.filter((type) =>
    handover.steps.some((step) => step.type === type && step.status === 'passed'),
  );
  return {
    passedCount: passed.length,
    total: SETUP_CHECK_ORDER.length,
    nextStep: SETUP_CHECK_ORDER.find((type) => !passed.includes(type)),
  };
}

export function telematicsStage(handover: MobileTelematicsHandover) {
  if (handover.eligibility.state === 'released') return 'released';
  if (handover.setup?.status === 'ready_for_release' && ['handover_preparation', 'handover_in_progress'].includes(handover.eligibility.state)) return 'awaiting_release';
  if (!handover.eligibility.canWorkSetup) return 'waiting';
  return deviceSetupProgress(handover).nextStep ? 'device_setup' : 'calibration';
}

export const CALIBRATION_CHECK_ORDER: readonly string[] = ['stationary_calibration', 'forward_calibration'];

export type SetupOverviewStage = {
  passedCount: number;
  total: number;
  status: 'locked' | 'available' | 'in_progress' | 'failed' | 'completed';
  canOpen: boolean;
};

export type TelematicsSetupView = 'overview' | 'device_setup' | 'calibration' | 'rental';

export function setupOverview(handover: MobileTelematicsHandover) {
  const stage = telematicsStage(handover);
  const canWork = handover.eligibility.canWorkSetup && ['device_setup', 'calibration'].includes(stage);
  const progress = (types: readonly string[], canOpen: boolean): SetupOverviewStage => {
    const steps = types.map((type) => handover.steps.find((step) => step.type === type));
    const passedCount = steps.filter((step) => step?.status === 'passed').length;
    return {
      passedCount,
      total: types.length,
      canOpen,
      status: passedCount === types.length ? 'completed' : !canOpen ? 'locked'
        : steps.some((step) => step?.status === 'failed') ? 'failed'
          : steps.some((step) => (step?.attemptCount ?? 0) > 0) ? 'in_progress' : 'available',
    };
  };
  const device = progress(SETUP_CHECK_ORDER, canWork);
  const calibration = progress(CALIBRATION_CHECK_ORDER, canWork && device.passedCount === device.total
    && handover.calibration.nextStep !== null && handover.calibration.context !== null);
  return {
    device,
    calibration,
    release: stage === 'released' ? 'released' as const : stage === 'awaiting_release' ? 'awaiting_staff' as const : 'locked' as const,
  };
}

export function resolveSetupView(handover: MobileTelematicsHandover, requested: TelematicsSetupView): TelematicsSetupView {
  const overview = setupOverview(handover);
  if (requested === 'device_setup' && overview.device.canOpen) return requested;
  if (requested === 'calibration' && overview.calibration.canOpen) return requested;
  if (requested === 'rental' && overview.release === 'released') return requested;
  return 'overview';
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
  if (telematicsStage(handover) === 'awaiting_release') {
    return { title: 'Ready for staff release', description: 'Wait for staff to release the vehicle.' };
  }
  const scheduledDate = handover.rentalStartAt
    ? new Date(handover.rentalStartAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })
    : 'your reserved rental period';
  return {
    verification_required: { title: 'Documents need approval', description: 'Submit your required documents for approval.' },
    other_rental_active: { title: 'Another self-drive rental is active', description: 'Ask staff to resolve your other rental or handover before continuing.' },
    waiting_for_confirmation: { title: 'Waiting for confirmation', description: 'Your booking must be confirmed before handover.' },
    rental_scheduled: { title: 'Rental scheduled', description: `Handover is available from ${scheduledDate} until the agreed rental end.` },
    inspection_required: { title: 'Waiting for outgoing inspection', description: 'Staff must complete the inspection and signatures.' },
    handover_preparation: { title: 'Preparing your handover', description: 'Wait for staff to start your handover.' },
    handover_in_progress: { title: 'Complete your setup checks', description: handover.eligibility.testMode ? 'Local test handover is active. Checks retain their real results; phone-mount confirmation allows staff to test release.' : 'Complete the checks below while safely parked.' },
    released: { title: 'Rental released', description: 'Setup results are read-only after release.' },
    rental_ended: { title: 'Rental ended', description: 'This rental has ended. Setup results are read-only.' },
  }[handover.eligibility.state];
}
