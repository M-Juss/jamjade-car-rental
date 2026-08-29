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
  calibrationStatus?: "locked" | "available" | "passed" | "failed";
  calibratedAt?: string | null;
  returnedAt?: string | null;
  completedAt?: string | null;
  returnChargesFinalizedAt?: string | null;
  readiness?: BookingReadiness;
  rentalProgress?: {
    outgoingFinalized: boolean;
    calibrationStatus: string;
    tripEnded: boolean;
    incomingFinalized: boolean;
  };
  inspections?: VehicleInspectionRecord[];
  inspectionBaseline?: VehicleInspectionRecord | null;
  additionalCharges?: AdditionalChargeRecord[];
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
  calibrationAvailable: boolean;
  calibrationPassed: boolean;
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
