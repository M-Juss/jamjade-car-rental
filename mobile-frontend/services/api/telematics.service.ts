import { apiGet, apiPost } from '@/services/http';

import { normalizeBookingImageUrl } from './booking.service';

export type MobileTelematicsHandover = {
  bookingCode: string;
  bookingStatus: 'pending' | 'confirmed' | 'ongoing' | 'returned' | 'completed';
  rentalStartAt?: string | null;
  rentalEndAt: string | null;
  vehicle: { name: string; image: string | null; secondaryImage: string | null };
  eligibility: {
    testMode: boolean;
    hasSelfDriveBooking: boolean;
    supportedRental: boolean;
    operatorAssigned: boolean;
    operatorEligible: boolean;
    documentsVerified: boolean;
    bookingConfirmed: boolean;
    rentalPeriodEligible: boolean;
    outgoingInspectionComplete: boolean;
    handoverStarted: boolean;
    customerSelfDriveAvailable: boolean;
    setupStatus?: 'locked' | 'setup_required' | 'in_progress' | 'ready_for_release' | 'released' | null;
    canViewTelematics: boolean;
    canStartHandover: boolean;
    canWorkSetup: boolean;
    state: 'verification_required' | 'waiting_for_confirmation' | 'rental_scheduled' | 'inspection_required' | 'handover_preparation' | 'handover_in_progress' | 'released' | 'other_rental_active' | 'rental_ended';
  };
  setup: {
    status: 'locked' | 'setup_required' | 'in_progress' | 'ready_for_release' | 'released';
    startedAt?: string | null;
    readyAt?: string | null;
    releasedAt?: string | null;
  } | null;
  steps: Array<{
    type: string;
    label: string;
    status: 'pending' | 'in_progress' | 'passed' | 'failed';
    attemptCount: number;
    startedAt?: string | null;
    completedAt?: string | null;
    failureReason?: string | null;
  }>;
  calibration: {
    protocolVersion: 3;
    profile: { id: 'standard' | 'rc_demo' | 'legacy'; revision: number | null; fingerprint: string | null };
    context: string | null;
    nextStep: string | null;
    captureSeconds: Record<string, number>;
    completionLimits: { minimumDurationMs: number; minimumCoverage: number; minimumSamplesPerSecond: number };
    stationaryLimits: { linearRms: number; rotationPeak: number; yawDegrees: number; tiltDegrees: number; maxGapMs: number };
    noiseBaseline: { linearRms: number; horizontalRms: number; linearStddev: number; rotationRms: number; rotationStddev: number } | null;
    forwardLimits: { acceleration: number; durationMs: number; coherence: number; samples: number };
    movementLimits: { tiltDegrees: number; rotationPeak: number; yawDegrees: number; forwardAccelerationOnly: boolean; brakingAcceleration: number; turnDegrees: number; oppositeTurnDegrees: number; turnDominance: number };
    reference: { down: [number, number, number]; forward: [number, number, number] | null } | null;
  };
  canBeginSetup: boolean;
  canContinueSetup: boolean;
  canStartTrip: boolean;
  tripStatus?: 'started' | 'paused' | 'ended' | null;
};

export async function getCurrentTelematicsSetup() {
  const response = await apiGet<MobileTelematicsHandover | null>('/mobile/telematics/setup');

  return mapHandover(response.data);
}

export async function getBookingTelematicsSetup(bookingId: string, signal?: AbortSignal) {
  const response = await apiGet<MobileTelematicsHandover>(
    `/mobile/bookings/${encodeURIComponent(bookingId)}/telematics-setup`, { signal },
  );

  return mapHandover(response.data);
}

export type TelematicsSetupAttemptEvidence = Record<string, boolean | number | string | null | undefined>;

export async function submitTelematicsSetupAttempt(
  bookingId: string,
  step: string,
  evidence: TelematicsSetupAttemptEvidence,
) {
  const response = await apiPost<MobileTelematicsHandover>(
    `/mobile/bookings/${encodeURIComponent(bookingId)}/telematics-setup/steps/${encodeURIComponent(step)}/attempt`,
    { evidence },
  );

  return mapHandover(response.data);
}

function mapHandover<T extends MobileTelematicsHandover | null>(value: T): T {
  if (!value) return value;
  return { ...value, vehicle: { ...value.vehicle,
    image: normalizeBookingImageUrl(value.vehicle.image),
    secondaryImage: normalizeBookingImageUrl(value.vehicle.secondaryImage),
  } };
}

export type MobileTelematicsRental = {
  bookingCode: string;
  bookingStatus: 'pending' | 'confirmed' | 'ongoing';
  vehicleName: string;
  image: string | null;
  rentalStartAt: string | null;
  rentalEndAt: string | null;
  rentalPeriodEnded: boolean;
  hasSetupAttempts: boolean;
  eligibility: MobileTelematicsHandover['eligibility'];
};

export async function getTelematicsRentals(page = 1) {
  const response = await apiGet<MobileTelematicsRental[]>(`/mobile/telematics/rentals?page=${page}`);
  return {
    rentals: response.data.map((rental) => ({ ...rental, image: normalizeBookingImageUrl(rental.image) })),
    lastPage: Number(response.meta?.last_page ?? 1),
  };
}
