export type BookingStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "ongoing"
  | "returned"
  | "completed"
  | "cancelled";

export type PaymentStatus =
  | "unpaid"
  | "pending"
  | "partial"
  | "paid"
  | "failed"
  | "refunded";

export type BookingRecord = {
  backendId: number;
  id: string;
  bookingCode: string;
  statusKey: BookingStatus;
  adminStatus: string;
  vehicleId: string;
  vehicleName?: string | null;
  brand?: string | null;
  model?: string | null;
  transmission?: string | null;
  fuelType?: string | null;
  seats?: number | null;
  rentalDate?: string | null;
  returnDate?: string | null;
  rentalStartAt?: string | null;
  rentalEndAt?: string | null;
  durationDays: number;
  pickupLocationType: "delivery" | "shop";
  pickupLocation: string;
  deliveryTimeLabel?: string | null;
  returnLocation: string;
  bookingType: string;
  rentalType: string;
  driverOption: "self_drive" | "owners_driver";
  ownerDriverCoverage?: "metro_manila" | "outside_manila" | null;
  pricePerDay: number;
  subtotal: number;
  deliveryFee: number;
  outsideManilaFee: number;
  ownerDriverFee: number;
  tollFee: number;
  lateFee: number;
  addOns: number;
  discount: number;
  downPayment: number;
  totalAmount: number;
  remainingBalance: number;
  paymentStatus: string;
  paymentStatusKey: PaymentStatus;
  createdAt?: string | null;
  notes?: string | null;
  adminNotes?: string | null;
  documents?: Array<{
    name: string;
    status: string;
  }>;
  customer?: {
    id: number;
    name: string;
    email: string;
    phoneNumber?: string | null;
    createdAt?: string | null;
  } | null;
  assignedDriver?: {
    id: number;
    name: string;
    phoneNumber?: string | null;
  } | null;
  driverAssignedAt?: string | null;
  telematicsSetupStatus?: "locked" | "setup_required" | "in_progress" | "ready_for_release" | "released" | null;
  telematicsHandover?: TelematicsHandover;
  returnedAt?: string | null;
  completedAt?: string | null;
  returnChargesFinalizedAt?: string | null;
  readiness?: BookingReadiness;
  rentalProgress?: {
    outgoingFinalized: boolean;
    telematicsSetupStatus?: string | null;
    tripEnded: boolean;
    latestTripStatus?: "started" | "paused" | "ended" | null;
    incomingFinalized: boolean;
  };
  inspections?: VehicleInspectionRecord[];
  inspectionBaseline?: VehicleInspectionRecord | null;
  additionalCharges?: AdditionalChargeRecord[];
};

export type TelematicsHandover = {
  bookingCode: string;
  bookingStatus: BookingStatus;
  eligibility?: {
    canStartHandover: boolean;
    documentsVerified: boolean;
    rentalPeriodEligible: boolean;
    outgoingInspectionComplete: boolean;
    geofenceAssigned: boolean;
  };
  setup: {
    status: "locked" | "setup_required" | "in_progress" | "ready_for_release" | "released";
    startedAt?: string | null;
    readyAt?: string | null;
    releasedAt?: string | null;
  } | null;
  geofence: {
    name: string;
    geometryType: "circle" | "polygon";
    centerLatitude: number | null;
    centerLongitude: number | null;
    radiusMeters: number | null;
    polygonCoordinates: GeofenceCoordinate[] | null;
  } | null;
  steps: Array<{
    type: string;
    label: string;
    status: "pending" | "in_progress" | "passed" | "failed";
    attemptCount: number;
    startedAt?: string | null;
    completedAt?: string | null;
    failureReason?: string | null;
  }>;
  canBeginSetup: boolean;
  canContinueSetup: boolean;
  canStartTrip: boolean;
  tripStatus?: "started" | "paused" | "ended" | null;
};

export type BookingReadiness = {
  bookingConfirmed: boolean;
  paymentAcceptedForInspection: boolean;
  fullyPaid: boolean;
  ageEligible: boolean;
  documentsApproved: boolean;
  driverAssigned: boolean;
  driverEligible: boolean;
  vehicleOperational: boolean;
  outgoingFinalized: boolean;
  telematicsSetupRequired: boolean;
  telematicsSetupReady: boolean;
  incomingFinalized: boolean;
  returnChargesFinalized: boolean;
  customerBalance: number;
  customerChargesSettled: boolean;
};

export type AdditionalChargeRecord = {
  id: string;
  type: string;
  typeLabel: string;
  description: string;
  amount: number;
  responsibility: "customer" | "driver";
  paymentStatus: PaymentStatus;
  paidAt?: string | null;
};

export type VehicleInspectionRecord = import("@/services/vehicle").VehicleInspectionRecord;

export type DriverCandidate = {
  id: number;
  name: string;
  phoneNumber?: string | null;
  activeAssignments: number;
  hasOutstandingBalance: boolean;
};

export type GeofenceTemplate = {
  id: number;
  name: string;
  geometryType: "circle" | "polygon";
  centerLatitude: number | null;
  centerLongitude: number | null;
  radiusMeters: number | null;
  polygonCoordinates: GeofenceCoordinate[] | null;
  isActive: boolean;
  isDeleted?: boolean;
  assignedBookingCount?: number;
};

export type GeofenceCoordinate = { latitude: number; longitude: number };
