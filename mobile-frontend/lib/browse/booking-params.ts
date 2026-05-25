import type { BookingFormData } from '@/types/browse';

export const encodeBookingData = (booking: BookingFormData) => encodeURIComponent(JSON.stringify(booking));

export const decodeBookingData = (booking?: string | string[]) => {
  const rawValue = Array.isArray(booking) ? booking[0] : booking;

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(rawValue)) as BookingFormData;
  } catch {
    return null;
  }
};

export const firstParam = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);
