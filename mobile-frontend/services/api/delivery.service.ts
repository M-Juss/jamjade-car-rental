import { apiGet, apiPost } from '@/services/http';
import { toBookingTimestamp } from '@/lib/browse/booking-time';
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
  requiresRequote: boolean;
  status:
    | 'offered'
    | 'awaiting_review'
    | 'ready'
    | 'rejected'
    | 'expired'
    | 'consumed'
    | 'superseded';
  expiresAt: string | null;
  reviewDeadline: string | null;
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
export type DeliveryEstimate = {
  distanceMeters: number;
  durationSeconds: number;
};
export type ConfirmedDelivery = DeliveryEstimate & { quote: DeliveryQuote };
export async function confirmDeliveryLocation(values: DeliveryRoutesValues) {
  return (
    await apiPost<ConfirmedDelivery>('/mobile/delivery/quotes', {
      vehicle_id: Number(values.vehicleId),
      rental_start_at: toBookingTimestamp(values.rentalStartAt),
      rental_end_at: toBookingTimestamp(values.rentalEndAt),
      owner_driver_coverage: values.ownerDriverCoverage,
      destination_address: values.address,
      destination_place_id: values.placeId || null,
      latitude: values.latitude,
      longitude: values.longitude,
      point_confirmed: values.pointConfirmed,
    })
  ).data;
}
export async function getBookingDeliveryEstimate(id: string) {
  return (await apiGet<DeliveryEstimate>(`/mobile/bookings/${encodeURIComponent(id)}/delivery-estimate`)).data;
}
export function quoteMatches(
  quote: DeliveryQuote,
  vehicleId: string,
  start: string,
  end: string,
  coverage: string,
  address: string,
) {
  return (
    quote.vehicleId === vehicleId &&
    Date.parse(quote.rentalStartAt) === Date.parse(toBookingTimestamp(start)) &&
    Date.parse(quote.rentalEndAt) === Date.parse(toBookingTimestamp(end)) &&
    quote.ownerDriverCoverage === coverage &&
    quote.destinationAddress === address
  );
}
