import type { BookingFormData, PriceBreakdown, Vehicle } from '@/types/browse';
import { vehicles } from '@/lib/browse/mock-data';

export const OWNER_DRIVER_METRO_MANILA_DAILY_RATE = 700;
export const OWNER_DRIVER_OUTSIDE_MANILA_DAILY_RATE = 1000;
export const DOWN_PAYMENT_RATE = 0.3;

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
    return 1;
  }

  const millisecondsPerDay = 1000 * 60 * 60 * 24;

  return Math.max(1, Math.ceil((end - start) / millisecondsPerDay));
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
  ownerDriverCoverage?: BookingFormData['ownerDriverCoverage'],
): PriceBreakdown => {
  const safeDays = Math.max(1, numberOfDays);
  const subtotal = vehicle.pricePerDay * safeDays;
  const ownerDriverRatePerDay = driverOption === 'owners_driver' ? getOwnerDriverRatePerDay(ownerDriverCoverage) : undefined;
  const ownerDriverFee = ownerDriverRatePerDay ? ownerDriverRatePerDay * safeDays : 0;
  const totalAmount = subtotal + ownerDriverFee;
  const downPaymentAmount = Math.ceil(totalAmount * DOWN_PAYMENT_RATE);

  return {
    pricePerDay: vehicle.pricePerDay,
    numberOfDays: safeDays,
    subtotal,
    ownerDriverFee,
    ownerDriverRatePerDay,
    totalAmount,
    downPaymentAmount,
    remainingBalance: totalAmount - downPaymentAmount,
  };
};

export const getVehicleById = (vehicleId?: string) => {
  return vehicles.find((vehicle) => vehicle.id === vehicleId);
};
