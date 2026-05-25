import { optionalServices, vehicles } from '@/lib/browse/mock-data';
import type { BookingFormData, PriceBreakdown, Vehicle } from '@/types/browse';

export const OUTSIDE_MANILA_FEE = 1000;
export const DOWN_PAYMENT_RATE = 0.3;

export const formatPeso = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const getServicePrice = (serviceId: string) => {
  const service = optionalServices.find((item) => item.id === serviceId);

  return service?.price ?? 0;
};

export const getOptionalServicesTotal = (selectedServiceIds: string[]) => {
  return selectedServiceIds.reduce((total, serviceId) => {
    if (serviceId === 'outside_manila') {
      return total;
    }

    return total + getServicePrice(serviceId);
  }, 0);
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

export const getPriceBreakdown = (
  vehicle: Vehicle,
  numberOfDays: number,
  selectedServiceIds: string[],
  paymentOption: BookingFormData['paymentOption'],
): PriceBreakdown => {
  const safeDays = Math.max(1, numberOfDays);
  const subtotal = vehicle.pricePerDay * safeDays;
  const optionalServicesTotal = getOptionalServicesTotal(selectedServiceIds);
  const outsideManilaFee = selectedServiceIds.includes('outside_manila') ? OUTSIDE_MANILA_FEE : 0;
  const totalAmount = subtotal + optionalServicesTotal + outsideManilaFee;

  if (paymentOption === 'down_payment') {
    const downPaymentAmount = Math.ceil(totalAmount * DOWN_PAYMENT_RATE);

    return {
      pricePerDay: vehicle.pricePerDay,
      numberOfDays: safeDays,
      subtotal,
      optionalServicesTotal,
      outsideManilaFee,
      totalAmount,
      downPaymentAmount,
      remainingBalance: totalAmount - downPaymentAmount,
    };
  }

  return {
    pricePerDay: vehicle.pricePerDay,
    numberOfDays: safeDays,
    subtotal,
    optionalServicesTotal,
    outsideManilaFee,
    totalAmount,
  };
};

export const getVehicleById = (vehicleId?: string) => {
  return vehicles.find((vehicle) => vehicle.id === vehicleId);
};
