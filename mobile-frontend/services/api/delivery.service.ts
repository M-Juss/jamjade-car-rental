import { apiGet, apiPost } from '@/services/http';
import type { DeliveryRoutesValues } from '@/validation/booking/delivery';
export type DeliveryQuote = {
  bookingId: string | null;
  id: string;
  vehicleId: string;
  rentalStartAt: string;
  rentalEndAt: string;
  ownerDriverCoverage: 'metro_manila' | 'outside_manila';
  destinationAddress: string;
  destinationPlaceId: string | null;
  destinationPoint: { latitude: number; longitude: number } | null;
  routeLabel: string;
  tollStatus: 'toll' | 'toll_free' | 'unknown';
  status:
    | 'offered'
    | 'awaiting_review'
    | 'ready'
    | 'rejected'
    | 'expired'
    | 'consumed'
    | 'superseded';
  expiresAt: string | null;
  reviewNote: string | null;
  pricePerDay: number;
  numberOfDays: number;
  subtotal: number;
  ownerDriverFee: number;
  deliveryFee: number;
  deliveryTollFee: number | null;
  totalAmount: number | null;
  downPaymentAmount: number | null;
};
export type DeliveryRoute = {
  quote: DeliveryQuote;
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string | null;
};
export async function requestDeliveryRoutes(values: DeliveryRoutesValues) {
  return (
    await apiPost<DeliveryRoute[]>('/mobile/delivery/routes', {
      vehicle_id: Number(values.vehicleId),
      rental_start_at: values.rentalStartAt,
      rental_end_at: values.rentalEndAt,
      owner_driver_coverage: values.ownerDriverCoverage,
      destination_address: values.address,
      destination_place_id: values.placeId || null,
      latitude: values.latitude,
      longitude: values.longitude,
      point_confirmed: values.pointConfirmed,
    })
  ).data;
}
export async function selectDeliveryRoute(id: string) {
  return (
    await apiPost<DeliveryQuote>(
      `/mobile/delivery/quotes/${encodeURIComponent(id)}/select`,
    )
  ).data;
}
export async function getDeliveryQuote(id: string) {
  return (
    await apiGet<DeliveryQuote>(
      `/mobile/delivery/quotes/${encodeURIComponent(id)}`,
    )
  ).data;
}
export function getDeliveryQuotes(page = 1, vehicleId?: string) {
  return apiGet<DeliveryQuote[]>(
    `/mobile/delivery/quotes?page=${page}${vehicleId ? `&vehicle_id=${encodeURIComponent(vehicleId)}` : ''}`,
  );
}
// Booking timestamps follow the existing Laravel UTC string contract.
export function quoteMatches(
  quote: DeliveryQuote,
  vehicleId: string,
  start: string,
  end: string,
  coverage: string,
  address: string,
) {
  const utcTime = (value: string) =>
    Date.parse(
      value.replace(' ', 'T') +
        (value.includes('Z') || /[+-]\d{2}:\d{2}$/.test(value) ? '' : ':00Z'),
    );
  return (
    quote.vehicleId === vehicleId &&
    Date.parse(quote.rentalStartAt) === utcTime(start) &&
    Date.parse(quote.rentalEndAt) === utcTime(end) &&
    quote.ownerDriverCoverage === coverage &&
    quote.destinationAddress === address
  );
}
