export type VehicleUnavailableDateRange = {
  startDate: string;
  endDate: string;
};

export type Vehicle = {
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
  vehicleId: string;
  rentalDate: string;
  returnDate: string;
  rentalStartAt: string;
  rentalEndAt: string;
  numberOfDays: number;
  pickupOption: 'shop' | 'delivery';
  pickupLocation: string;
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
  ownerDriverFee: number;
  ownerDriverRatePerDay?: number;
  totalAmount: number;
  downPaymentAmount: number;
  remainingBalance: number;
};
