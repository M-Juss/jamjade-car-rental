import { apiPost } from '@/services/http';

export type MobileTelematicsTrip = {
  id: number;
  bookingId: string;
  status: 'started' | 'paused' | 'ended';
  startedAt?: string | null;
  endedAt?: string | null;
};

export async function startTelematicsTrip(bookingId: number) {
  const response = await apiPost<MobileTelematicsTrip>('/mobile/telematics/trips/start', {
    booking_id: bookingId,
    latitude: 14.299,
    longitude: 120.958,
    current_zone: 'Jamjade mobile session',
  });

  return response.data;
}

export async function endTelematicsTrip(tripId: number) {
  const response = await apiPost<MobileTelematicsTrip>(
    `/mobile/telematics/trips/${tripId}/end`,
    {},
  );

  return response.data;
}
