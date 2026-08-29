export type BookingStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Active'
  | 'Ongoing'
  | 'Returned'
  | 'Completed'
  | 'Rejected'
  | 'Cancelled';

export type BookingStatusFilter = 'All' | Exclude<BookingStatus, 'Ongoing'>;

export type PaymentStatus = 'Unpaid' | 'Partially Paid' | 'Paid' | 'Refunded';

export type DocumentStatus = 'Submitted' | 'Pending' | 'Missing' | 'Verified';

export type DriverType = 'Self-Drive' | "Owner's Driver";

export type BookingDocument = {
  name: string;
  status: DocumentStatus;
};

export type BookingTimelineItem = {
  title: string;
  description: string;
  timestamp: string;
  completed: boolean;
};

export type Booking = {
  id: string;
  backendId: number;
  vehicleName: string;
  brand: string;
  model: string;
  image: string;
  status: BookingStatus;
  rentalDate: string;
  returnDate: string;
  duration: number;
  pickupType: 'Delivery' | 'Shop Pickup';
  pickupLocation: string;
  deliveryTime?: string | null;
  returnLocation: string;
  driverType: DriverType;
  bookingType: DriverType;
  transmission: 'Automatic' | 'Manual';
  fuelType: 'Gasoline' | 'Diesel' | 'Hybrid' | 'Electric';
  seats: number;
  pricePerDay: number;
  subtotal: number;
  deliveryFee: number;
  outsideManilaFee: number;
  ownerDriverFee: number;
  optionalServices: number;
  addOns: number;
  discount: number;
  downPayment: number;
  totalAmount: number;
  remainingBalance: number;
  balanceDueAt?: string | null;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  transactionId: string;
  paidAt: string;
  createdAt: string;
  adminNotes: string;
  calibrationStatus: 'locked' | 'available' | 'passed' | 'failed';
  calibratedAt?: string | null;
  rentalProgress: {
    outgoingFinalized: boolean;
    calibrationStatus: string;
    tripEnded: boolean;
    latestTripId?: number | null;
    latestTripStatus?: string | null;
    incomingFinalized: boolean;
  };
  additionalCharges: {
    id: string;
    type: string;
    typeLabel: string;
    description: string;
    amount: number;
    responsibility: 'customer' | 'driver';
    paymentStatus: string;
    paidAt?: string | null;
  }[];
  customer?: { name?: string; email?: string; phoneNumber?: string | null } | null;
  documents: BookingDocument[];
  timeline: BookingTimelineItem[];
};

export const BOOKING_STATUS_FILTERS: BookingStatusFilter[] = [
  'All',
  'Pending',
  'Confirmed',
  'Active',
  'Returned',
  'Completed',
  'Rejected',
  'Cancelled',
];
