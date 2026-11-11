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
  sharedVehicleLocation?: { latitude: number; longitude: number; accuracy: number; sharedAt: string } | null;
  cancellation?: { kind: 'customer' | 'management' | 'no_show' | 'payment_deadline'; reason: string; refundAmount: number | null; refundStatus: 'pending_review' | 'approved' | 'declined' | 'refunded' | 'not_eligible'; refundReason: string | null; reviewedAt: string | null; refundedAt: string | null } | null;
  lateReturn?: import('@/types/browse').LateReturnDetails;
  attention?: { key: string; label: string } | null;
  id: string;
  backendId: number;
  canReviseUnpaid?: boolean;
  vehicleId: string;
  ownerDriverCoverage?: 'metro_manila' | 'outside_manila' | null;
  vehicleName: string;
  vehiclePlateNumber?: string | null;
  brand: string;
  model: string;
  color: string | null;
  image: string;
  status: BookingStatus;
  rentalDate: string;
  returnDate: string;
  rentalEndAt?: string | null;
  duration: number;
  pickupType: 'Delivery' | 'Shop Pickup';
  pickupLocation: string;
  notes?: string | null;
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
  deliveryTollFee: number;
  deliveryLocation?: { address: string; placeId: string | null; point: { latitude: number; longitude: number } | null; routeLabel: string } | null;

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
  telematicsSetupStatus?: 'locked' | 'setup_required' | 'in_progress' | 'ready_for_release' | 'released' | null;
  rentalProgress: {
    outgoingFinalized: boolean;
    telematicsSetupStatus?: string | null;
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
    outstandingAmount: number;
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
