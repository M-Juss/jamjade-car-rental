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

export type BookingAttention = { key: "overdue_return" | "not_started" | "return_processing" | "awaiting_settlement" | "ready_to_complete"; label: string };
export type LateReturnPolicy = { seats: number; seatBracket: "up_to_5" | "6_and_above"; hourlyRate: number; minimumHours: number; roundUpAfterMinutes: number; dailyConversion: boolean; version: string };
export type LateReturnDetails = {
  vehicleReceivedAt: string | null; expectedReturnAt: string | null; elapsedMinutes: number;
  billableHours: number; hourlyRate: number | null; seatBracket: string | null; estimatedAmount: number | null;
  requiresManualPricing: boolean; reviewedAt: string | null; approvedAmount: number | null; policy: LateReturnPolicy | null;
};
export type BookingCancellation = {
  kind: "customer" | "management" | "payment_deadline" | "no_show";
  reason: string; refundAmount: number | null;
  refundStatus: "pending_review" | "approved" | "declined" | "refunded" | "not_eligible";
  refundReason: string | null; reviewedAt: string | null; refundedAt: string | null;
};
export type BookingRecord = {
  cancellation?: BookingCancellation | null;
  canReviewCancellationRefund?: boolean;
  attention?: BookingAttention | null;
  lateReturn?: LateReturnDetails;
  returnFollowUps?: Array<{ note: string; recordedAt: string }>;
  upcomingBookings?: Array<{ id: number; bookingCode: string; pickupAt: string }>;
  backendId: number;
  id: string;
  bookingCode: string;
  statusKey: BookingStatus;
  adminStatus: string;
  vehicleId: string;
  vehicleName?: string | null;
  vehiclePlateNumber?: string | null;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
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
  deliveryTollFee: number;
  deliveryLocation?: { address: string; placeId: string | null; point: { latitude: number; longitude: number } | null; routeLabel: string } | null;

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
  monitoringZones?: BookingMonitoringZone[];
  canManageMonitoringZones?: boolean;
  geofenceActivity?: Array<{ id: string; type: "geofence_enter" | "geofence_exit"; zoneName: string; notificationRequested: boolean; occurredAt: string }>;

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
  calibration: {
    profile: { id: "standard" | "rc_demo" | "legacy"; revision: number | null; fingerprint: string | null };
  };
  bookingCode: string;
  bookingStatus: BookingStatus;
  eligibility?: {
    testMode: boolean;
    supportedRental: boolean;
    operatorAssigned: boolean;
    operatorEligible: boolean;
    canStartHandover: boolean;
    documentsVerified: boolean;
    rentalPeriodEligible: boolean;
    outgoingInspectionComplete: boolean;
    customerSelfDriveAvailable: boolean;
  };
  setup: {
    status: "locked" | "setup_required" | "in_progress" | "ready_for_release" | "released";
    startedAt?: string | null;
    readyAt?: string | null;
    releasedAt?: string | null;
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
  vehicleReceived: boolean;
  bookingConfirmed: boolean;
  rentalPeriodEligible: boolean;
  outgoingInspectionTimeEligible: boolean;
  customerSelfDriveAvailable: boolean;
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
  outstandingAmount: number;
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

export type BookingMonitoringZone = {
  id: string | null;
  name: string;
  scope: "default" | "custom";
  geometryType: "circle" | "polygon";
  centerLatitude: number | null;
  centerLongitude: number | null;
  radiusMeters: number | null;
  polygonCoordinates: GeofenceCoordinate[] | null;
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
  frozenAt: string | null;
};

export type GeofenceCoordinate = { latitude: number; longitude: number };
