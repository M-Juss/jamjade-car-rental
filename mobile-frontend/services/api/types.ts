export type UserRole = 'admin' | 'staff' | 'customer' | 'driver' | string;

export type MobileCustomerProfile = {
  id?: number;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string;
  email?: string;
  phoneNumber?: string | null;
  address?: string | null;
  addressDetails?: {
    countryCode: string;
    regionCode: string;
    provinceCode: string | null;
    cityMunicipalityCode: string;
    barangayCode: string;
    addressLine: string;
    postalCode: string | null;
    formattedAddress: string | null;
  } | null;
  dateOfBirth?: string | null;
  birthdate?: string | null;
  profilePicture?: string;
  profileCompletedAt?: string | null;
  emergencyContactSkippedAt?: string | null;
  canSelfDrive?: boolean;
  verificationStatus?: string | null;
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
  addressDetails: {
    countryCode: string;
    regionCode: string;
    provinceCode: string | null;
    cityMunicipalityCode: string;
    barangayCode: string;
    addressLine: string;
    postalCode: string;
    formattedAddress: string;
  };
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
  lateReturnPolicy: import('@/types/browse').LateReturnPolicy;
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
  notes?: string | null;
  deliveryQuoteId?: string;
  vehicleId: string;
  rentalStartAt: string;
  rentalEndAt: string;
  pickupLocationType: 'shop' | 'delivery';
  pickupLocation: string;
  returnLocation: string;
  driverOption: 'self_drive' | 'owners_driver';
  ownerDriverCoverage?: 'metro_manila' | 'outside_manila';
  paymentOption: PayPalPaymentOption;
  reviewedPricing: { pricePerDay: number; subtotal: number; deliveryFee: number; deliveryTollFee: number; ownerDriverFee: number; totalAmount: number };
  customerSignature: string;
  termsVersion: string;
  lateReturnPolicyVersion: string;
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
  sharedVehicleLocation?: { latitude: number; longitude: number; accuracy: number; sharedAt: string } | null;
  notes?: string | null;
  cancellation?: { kind: 'customer' | 'management' | 'no_show' | 'payment_deadline'; reason: string; refundAmount: number | null; refundStatus: 'pending_review' | 'approved' | 'declined' | 'refunded' | 'not_eligible'; refundReason: string | null; reviewedAt: string | null; refundedAt: string | null } | null;
  lateReturn?: import('@/types/browse').LateReturnDetails;
  attention?: { key: string; label: string } | null;
  backendId: number;
  id: string;
  bookingCode: string;
  status: 'Pending' | 'Confirmed' | 'Active' | 'Ongoing' | 'Returned' | 'Completed' | 'Rejected' | 'Cancelled';
  vehicleId: string;
  vehicleName: string;
  vehiclePlateNumber?: string | null;
  brand: string;
  model: string;
  color: string | null;
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
  deliveryTollFee: number;
  deliveryLocation?: { address: string; placeId: string | null; point: { latitude: number; longitude: number } | null; routeLabel: string } | null;

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
  telematicsSetupStatus?: 'locked' | 'setup_required' | 'in_progress' | 'ready_for_release' | 'released' | null;
  rentalProgress: {
    outgoingFinalized: boolean;
    telematicsSetupStatus?: string | null;
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
    outstandingAmount: number;
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

export type CustomerReceipt = {
  id: number;
  bookingReference: string;
  receiptReference: string;
  issuedAt: string;
  currency: 'PHP';
  amount: number;
  purpose: string;
  paidAt: string | null;
  method: string | null;
  transactionReference: string | null;
  vehicleName: string;
  rentalType: string;
  rentalStartAt: string | null;
  rentalEndAt: string | null;
  totalPaid: number;
  remainingBalance: number;
  bookingTotal: number;
  agreedRentalTotal: number;
  additionalCharges: { label: string; amount: number }[];
  settlementStatus: string;
  balanceDueAt: string | null;
  downloadReady: boolean;
};

export type CustomerReceiptPage = {
  receipts: CustomerReceipt[];
  page: number;
  lastPage: number;
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
