import { bookingFormSchema, type BookingValidationInput } from '@/validation/booking/schemas';
import type { VehicleUnavailableDateRange } from '@/types/browse';

export function overlapsUnavailableDates(
  startDate: string,
  endDate: string,
  unavailableDateRanges: VehicleUnavailableDateRange[],
) {
  return unavailableDateRanges.some((range) => startDate <= range.endDate && endDate >= range.startDate);
}

export function canReviewBooking(
  values: BookingValidationInput,
  unavailableDateRanges: VehicleUnavailableDateRange[],
  hasReadyDeliveryQuote: boolean,
) {
  return bookingFormSchema.safeParse(values).success &&
    !overlapsUnavailableDates(values.rentalDate, values.returnDate, unavailableDateRanges) &&
    (values.pickupOption === 'shop' || hasReadyDeliveryQuote);
}
