import type { Booking } from '@/types/booking';
import type { MobileTelematicsHandover } from '@/services/api/telematics.service';

function timestamp(value: string | null | undefined) {
  const result = value ? Date.parse(value) : NaN;
  return Number.isFinite(result) ? result : null;
}

export function rentalTiming(releasedAt: string | null | undefined, returnAt: string | null | undefined, now: number) {
  const released = timestamp(releasedAt);
  const due = timestamp(returnAt);
  return {
    elapsedMs: released === null ? null : Math.max(0, now - released),
    remainingMs: due === null ? null : Math.max(0, due - now),
    overdueMs: due === null ? null : Math.max(0, now - due),
    returnDue: due !== null && now >= due,
  };
}

export function formatRentalDuration(milliseconds: number | null) {
  if (milliseconds === null || !Number.isFinite(milliseconds)) return '—';
  const minutes = Math.floor(Math.max(0, milliseconds) / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor(minutes % 1440 / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return minutes === 0 ? 'Less than 1m' : `${minutes}m`;
}

export function rentalVehicleName(booking: Booking | undefined) {
  return booking ? booking.vehicleName || [booking.brand, booking.model].filter(Boolean).join(' ') || 'Your vehicle' : 'Your vehicle';
}

export function rentalTripLabel(status: MobileTelematicsHandover['tripStatus']) {
  return status === 'started' ? 'Started' : status === 'paused' ? 'Paused' : status === 'ended' ? 'Ended' : 'Not started';
}
