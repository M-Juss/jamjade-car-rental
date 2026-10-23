export type LateReturnPolicy = { seats: number; seatBracket: 'up_to_5' | '6_and_above'; hourlyRate: number; minimumHours: number; roundUpAfterMinutes: number; dailyConversion: boolean; version: string };
export type LateReturnDetails = { vehicleReceivedAt: string | null; expectedReturnAt: string | null; elapsedMinutes: number; billableHours: number; hourlyRate: number | null; seatBracket: string | null; estimatedAmount: number | null; reviewedAt: string | null; approvedAmount: number | null; requiresManualPricing: boolean; policy: LateReturnPolicy | null };

export type VehicleUnavailableDateRange = {
  startDate: string;
  endDate: string;
};

export type Vehicle = {
  lateReturnPolicy: LateReturnPolicy;
  id: string;
  name: string;
  brand: string;
  model: string;
  pricePerDay: number;
  status: 'available' | 'rented' | 'maintenance' | 'unavailable';
  cardImage: string | null;
  images: string[];
  seats: number;
  transmission: string;
  fuelType: string;
  color: string;
  features: string[];
  description: string;
  isFeatured?: boolean;
  unavailableDateRanges: VehicleUnavailableDateRange[];
  createdAt: string;
};

export type BookingFormData = {
  lateReturnPolicy?: LateReturnPolicy;
  deliveryQuoteId?: string;
  deliveryQuoteExpiresAt?: string;
  priceBreakdown?: PriceBreakdown;
  vehicleId: string;
  rentalDate: string;
  returnDate: string;
  rentalStartAt: string;
  rentalEndAt: string;
  numberOfDays: number;
  pickupOption: 'shop' | 'delivery';
  pickupLocation: string;
  notes?: string | null;
  deliveryTime?: string;
  returnLocation: string;
  driverOption: 'self_drive' | 'owners_driver';
  ownerDriverCoverage?: 'metro_manila' | 'outside_manila';
  totalAmount: number;
  downPaymentAmount: number;
  remainingBalance: number;
};

export type OptionalService = {
  id: string;
  label: string;
  description: string;
  price: number;
};

export type PriceBreakdown = {
  pricePerDay: number;
  numberOfDays: number;
  subtotal: number;
  deliveryFee: number;
  deliveryTollFee: number;
  ownerDriverFee: number;
  ownerDriverRatePerDay?: number;
  totalAmount: number;
  downPaymentAmount: number;
  remainingBalance: number;
};
