import type { BookingFormData, PriceBreakdown, Vehicle } from '@/types/browse';
import type { DeliveryQuote } from '@/services/api/delivery.service';

export const OWNER_DRIVER_METRO_MANILA_DAILY_RATE = 700;
export const OWNER_DRIVER_OUTSIDE_MANILA_DAILY_RATE = 1000;
export const DOWN_PAYMENT_RATE = 0.5;

export const formatPeso = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const getNumberOfDays = (rentalDate: string, returnDate: string) => {
  const start = Date.parse(rentalDate);
  const end = Date.parse(returnDate);

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 0;
  }

  const millisecondsPerDay = 1000 * 60 * 60 * 24;

  return Math.max(0, Math.ceil((end - start) / millisecondsPerDay));
};

export const formatBookingDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return value;
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

export const getOwnerDriverRatePerDay = (coverage?: BookingFormData['ownerDriverCoverage']) => {
  if (coverage === 'outside_manila') {
    return OWNER_DRIVER_OUTSIDE_MANILA_DAILY_RATE;
  }

  return OWNER_DRIVER_METRO_MANILA_DAILY_RATE;
};

export const getPriceBreakdown = (
  vehicle: Vehicle,
  numberOfDays: number,
  driverOption: BookingFormData['driverOption'],
  pickupOption: BookingFormData['pickupOption'],
  ownerDriverCoverage?: BookingFormData['ownerDriverCoverage'],
  _pickupLocation?: string,
  quote?: DeliveryQuote,
): PriceBreakdown => {
  const safeDays = Math.max(0, numberOfDays);
  const subtotal = vehicle.pricePerDay * safeDays;
  const deliveryFee = pickupOption === 'delivery' ? quote?.deliveryFee ?? 0 : 0;
  const deliveryTollFee = pickupOption === 'delivery' ? quote?.deliveryTollFee ?? 0 : 0;
  const ownerDriverRatePerDay = driverOption === 'owners_driver' ? getOwnerDriverRatePerDay(ownerDriverCoverage) : undefined;
  const ownerDriverFee = ownerDriverRatePerDay ? ownerDriverRatePerDay * safeDays : 0;
  const totalAmount = quote?.totalAmount ?? subtotal + deliveryFee + deliveryTollFee + ownerDriverFee;
  const downPaymentAmount = Math.ceil(totalAmount * DOWN_PAYMENT_RATE);

  return {
    pricePerDay: quote?.pricePerDay ?? vehicle.pricePerDay,
    numberOfDays: safeDays,
    subtotal: quote?.subtotal ?? subtotal,
    deliveryFee,
    deliveryTollFee,
    ownerDriverFee: quote?.ownerDriverFee ?? ownerDriverFee,
    ownerDriverRatePerDay,
    totalAmount,
    downPaymentAmount,
    remainingBalance: totalAmount - downPaymentAmount,
  };
};
