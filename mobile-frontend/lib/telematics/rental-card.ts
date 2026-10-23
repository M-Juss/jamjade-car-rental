import type { MobileTelematicsRental } from '@/services/api/telematics.service';

export function rentalCardState(rental: MobileTelematicsRental) {
  const { eligibility } = rental;
  if (eligibility.state === 'released') {
    return { canOpen: true, status: 'Rental ongoing', action: 'Open rental', description: null };
  }
  if (rental.rentalPeriodEnded) {
    return { canOpen: false, status: 'Rental period ended', action: 'Setup locked', description: 'Contact staff about this booking.' };
  }
  if (eligibility.setupStatus === 'ready_for_release' && ['handover_preparation', 'handover_in_progress'].includes(eligibility.state)) {
    return { canOpen: true, status: 'Awaiting staff release', action: 'View setup', description: null };
  }
  if (eligibility.canWorkSetup) {
    return { canOpen: true, status: 'Setup available', action: rental.hasSetupAttempts ? 'Continue setup' : 'Begin setup', description: null };
  }
  const reasons = {
    verification_required: ['Documents need approval', 'Review your required documents.'],
    waiting_for_confirmation: ['Waiting for confirmation', 'Staff must confirm your booking.'],
    rental_scheduled: ['Rental scheduled', `Setup is available during your rental period, from ${formatRentalDate(rental.rentalStartAt)}.`],
    inspection_required: ['Waiting for inspection', 'Staff must complete the outgoing inspection and signatures.'],
    handover_preparation: ['Waiting for staff', 'Staff must start your handover.'],
    other_rental_active: ['Another rental is active', 'Ask staff to resolve your other rental or handover.'],
    handover_in_progress: ['Setup unavailable', 'Refresh your rental or contact staff.'],
    rental_ended: ['Rental ended', 'View the booking for rental details.'],
  } as const;
  const [status, description] = reasons[eligibility.state];
  return { canOpen: false, status, description, action: 'Setup locked' };
}

export function formatRentalDate(value: string | null) {
  return value ? new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : 'Not scheduled';
}

export function formatRentalDateCompact(value: string | null) {
  return value ? new Date(value).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }) : 'Not scheduled';
}
