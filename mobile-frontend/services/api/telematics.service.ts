import { apiGet, apiPost } from '@/services/http';

export type MobileTelematicsHandover = {
  bookingCode: string;
  bookingStatus: 'pending' | 'confirmed' | 'ongoing';
  rentalStartAt?: string | null;
  eligibility: {
    testMode: boolean;
    hasSelfDriveBooking: boolean;
    documentsVerified: boolean;
    bookingConfirmed: boolean;
    rentalPeriodEligible: boolean;
    outgoingInspectionComplete: boolean;
    handoverStarted: boolean;
    setupStatus?: 'locked' | 'setup_required' | 'in_progress' | 'ready_for_release' | 'released' | null;
    canViewTelematics: boolean;
    canStartHandover: boolean;
    canWorkSetup: boolean;
    state: 'verification_required' | 'waiting_for_confirmation' | 'rental_scheduled' | 'inspection_required' | 'handover_preparation' | 'handover_in_progress' | 'released';
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
  canBeginSetup: boolean;
  canContinueSetup: boolean;
  canStartTrip: boolean;
  tripStatus?: 'started' | 'paused' | 'ended' | null;
};

export async function getCurrentTelematicsSetup() {
  const response = await apiGet<MobileTelematicsHandover | null>('/mobile/telematics/setup');

  return response.data;
}

export async function getBookingTelematicsSetup(bookingId: string) {
  const response = await apiGet<MobileTelematicsHandover>(
    `/mobile/bookings/${encodeURIComponent(bookingId)}/telematics-setup`,
  );

  return response.data;
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

  return response.data;
}
