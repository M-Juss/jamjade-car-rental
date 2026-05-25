export type BookingStatus =
  | 'Pending'
  | 'Approved'
  | 'Active'
  | 'Ongoing'
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
  vehicleName: string;
  brand: string;
  model: string;
  plateNumber: string;
  image: string;
  status: BookingStatus;
  rentalDate: string;
  returnDate: string;
  duration: number;
  pickupType: 'Delivery' | 'Shop Pickup';
  pickupLocation: string;
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
  optionalServices: number;
  addOns: number;
  discount: number;
  downPayment: number;
  totalAmount: number;
  remainingBalance: number;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  transactionId: string;
  paidAt: string;
  createdAt: string;
  adminNotes: string;
  documents: BookingDocument[];
  timeline: BookingTimelineItem[];
};

export const BOOKING_STATUS_FILTERS: BookingStatusFilter[] = [
  'All',
  'Pending',
  'Approved',
  'Active',
  'Completed',
  'Rejected',
  'Cancelled',
];
