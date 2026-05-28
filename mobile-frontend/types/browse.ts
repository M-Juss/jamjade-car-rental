export type Vehicle = {
  id: string;
  name: string;
  model: string;
  year: number;
  pricePerDay: number;
  status: 'available' | 'rented' | 'maintenance';
  images: string[];
  location: string;
  seats: number;
  transmission: 'Automatic' | 'Manual';
  fuelType: 'Gasoline' | 'Diesel';
  color: string;
  features: string[];
  description: string;
  isMostBooked?: boolean;
  createdAt: string;
};

export type BookingFormData = {
  vehicleId: string;
  rentalDate: string;
  returnDate: string;
  numberOfDays: number;
  pickupOption: 'shop' | 'delivery';
  pickupLocation: string;
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
  ownerDriverFee: number;
  ownerDriverRatePerDay?: number;
  totalAmount: number;
  downPaymentAmount: number;
  remainingBalance: number;
};
