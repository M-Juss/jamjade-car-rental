export type UserRole = 'admin' | 'staff' | 'customer' | 'driver' | string;

export type MobileCustomerProfile = {
  id?: number;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string;
  email?: string;
  phoneNumber?: string | null;
  address?: string | null;
  dateOfBirth?: string | null;
  birthdate?: string | null;
  profilePicture?: string;
  profileCompletedAt?: string | null;
  emergencyContactSkippedAt?: string | null;
  canSelfDrive?: boolean;
  verificationStatus?: string | null;
  passportRequired?: boolean;
  drivingIntent?: 'self_drive' | 'owner_driver' | 'not_sure' | null;
  joinedSince?: string | null;
};

export type MobileUser = {
  id: number;
  name: string;
  email: string;
  phoneNumber?: string | null;
  isActive?: boolean;
  roles?: UserRole[];
  lastLoginAt?: string | null;
  createdAt?: string | null;
  profile?: MobileCustomerProfile | null;
};

export type MobileLoginPayload = {
  email?: string;
  login?: string;
  phone_number?: string;
  password: string;
  device_name?: string;
};

export type MobileRegisterPayload = {
  email: string;
  password: string;
  password_confirmation: string;
  device_name?: string;
};

export type MobileAuthResponse = {
  tokenType: string;
  token: string;
  user: MobileUser;
};

export type MobileCurrentUserResponse = {
  user: MobileUser;
};

export type MobileEmergencyContact = {
  id: number;
  name: string;
  relationship: string;
  phone_number: string;
};

export type MobileDocument = {
  id: number;
  documentType: string;
  name?: string;
  documentNumber?: string | null;
  expiresAt?: string | null;
  status?: string;
  statusKey: 'pending' | 'approved' | 'rejected';
  fileUrl?: string | null;
  frontFileUrl?: string | null;
  backFileUrl?: string | null;
  submittedAt?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  updatedAt?: string | null;
};

export type MobileProfileOverview = {
  user: MobileUser;
  profile: MobileCustomerProfile;
  documents: MobileDocument[];
  emergencyContacts: MobileEmergencyContact[];
  selfDriveAvailability: {
    canSelfDrive: boolean;
    requiredDocuments: {
      documentType: string;
      name: string;
    }[];
  };
  bookingSummary: {
    status: 'none' | 'pending' | 'active' | 'ongoing' | 'returned' | 'completed';
    successfulBookings: number;
    totalSpent: number;
    hasOutstandingBalance: boolean;
  };
};

export type ProfileUpdatePayload = {
  firstName: string;
  lastName: string;
  contactNumber: string;
  birthdate: string;
  address: string;
  profilePicture: string;
};

export type ProfileCompletionPayload = {
  drivingIntent: 'self_drive' | 'owner_driver' | 'not_sure';
};

export type EmergencyContactPayload = {
  name: string;
  relationship: string;
  contactNumber: string;
};

export type MobileVehicleRecord = {
  id: string;
  name: string;
  brand: string;
  model: string;
  pricePerDay: number | string;
  status: 'available' | 'rented' | 'maintenance' | 'unavailable';
  cardImage?: string | null;
  image?: string | null;
  images?: (string | null)[];
  seats: number | string;
  transmission: string;
  fuelType: string;
  color: string;
  features?: string[];
  description?: string | null;
  isFeatured?: boolean;
  unavailableDateRanges?: {
    startDate: string;
    endDate: string;
  }[];
  createdAt?: string | null;
};

export type PayPalPaymentOption = 'down_payment' | 'full_payment';

export type PayPalOrderPayload = {
  vehicleId: string;
  rentalStartAt: string;
  rentalEndAt: string;
  pickupLocationType: 'shop' | 'delivery';
  pickupLocation: string;
  returnLocation: string;
  driverOption: 'self_drive' | 'owners_driver';
  ownerDriverCoverage?: 'metro_manila' | 'outside_manila';
  paymentOption: PayPalPaymentOption;
  customerSignature: string;
  termsVersion: string;
  appReturnUrl: string;
  appCancelUrl: string;
};

export type PayPalOrderResponse = {
  checkoutId: number;
  orderId: string;
  approvalUrl: string;
  amount: number;
  currency: 'PHP';
  bookingCode: string;
};

export type MobileBookingRecord = {
  backendId: number;
  id: string;
  bookingCode: string;
  status: 'Pending' | 'Confirmed' | 'Active' | 'Ongoing' | 'Returned' | 'Completed' | 'Rejected' | 'Cancelled';
  vehicleId: string;
  vehicleName: string;
  brand: string;
  model: string;
  image?: string | null;
  rentalDate: string;
  returnDate: string;
  rentalStartAt: string;
  rentalEndAt: string;
  duration: number;
  pickupType: 'Delivery' | 'Shop Pickup';
  pickupLocation: string;
  deliveryTime?: string | null;
  deliveryTimeLabel?: string | null;
  returnLocation: string;
  driverType: 'Self-Drive' | "Owner's Driver";
  bookingType: 'Self-Drive' | "Owner's Driver";
  transmission: string;
  fuelType: string;
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
  paymentStatus: string;
  paymentStatusKey: 'unpaid' | 'pending' | 'partial' | 'paid' | 'failed' | 'refunded';
  remainingBalance: number;
  balanceDueAt?: string | null;
  totalAmount: number;
  paymentMethod: string;
  transactionId: string;
  paidAt: string;
  createdAt: string;
  adminNotes?: string | null;
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
  additionalCharges?: {
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
  documents: {
    name: string;
    status: 'Submitted' | 'Pending' | 'Missing' | 'Verified';
  }[];
  timeline: {
    title: string;
    description: string;
    timestamp: string;
    completed: boolean;
  }[];
};

export type MobileNotificationRecord = {
  id: string;
  type: string;
  category: 'booking' | 'payment' | 'vehicle' | 'trip' | 'system';
  priority: 'normal' | 'success' | 'warning' | 'urgent';
  title: string;
  message: string;
  fullMessage: string;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  bookingId?: string | null;
  documentId?: number | null;
  vehicleName?: string | null;
  paymentStatus?: string | null;
  tripStatus?: string | null;
  actionLabel?: string | null;
  data?: Record<string, unknown>;
};
