import type {
  VehicleConditionUpdateFormValues,
  VehicleConditionFormValues,
  VehicleFormValues,
} from "@/validations/vehicle/schemas";
import type {
  VehicleBodyMarker,
  VehicleIssueType,
  VehiclePanelName,
} from "@/components/vehicle-inspection";

export type VehicleStatus = "available" | "rented" | "maintenance" | "unavailable";

export type VehicleRecord = {
  id: string;
  name: string;
  brand: string;
  model?: string | null;
  pricePerDay: number;
  price: number;
  seats: number;
  transmission: string;
  fuelType: string;
  fuel: string;
  color?: string | null;
  status: VehicleStatus | string;
  statusLabel?: string;
  description?: string | null;
  isMostBooked?: boolean;
  images: string[];
  imageRecords?: Array<{
    id: number;
    url: string | null;
    imagePath: string | null;
    isPrimary: boolean;
    sortOrder: number;
  }>;
  image?: string | null;
  features: string[];
  createdAt?: string | null;
  hasCurrentCondition?: boolean;
  currentCondition?: VehicleInspectionRecord | null;
  hasOngoingRental?: boolean;
  canUpdateCurrentCondition?: boolean;
  conditionUpdateBlockedReason?: string | null;
  unavailableDateRanges?: Array<{ startDate: string; endDate: string }>;
};

export type CreateVehicleRequestPayload = VehicleFormValues;

export type VehicleInspectionChecklistItem = {
  key: string;
  label: string;
  value: boolean;
  notes?: string | null;
};

export type VehicleInspectionRecord = {
  id: string;
  vehicleId: string;
  booking?: { id: string; reference: string } | null;
  type: "initial" | "outgoing" | "incoming" | "condition_update";
  typeLabel?: string;
  status: "draft" | "finalized";
  odometer: number;
  fuelLevel: number;
  comments?: string | null;
  conditionUpdateReason?: VehicleConditionUpdateReason | null;
  conditionUpdateReasonLabel?: string | null;
  conditionUpdateNotes?: string | null;
  basedOnInspectionId?: string | null;
  basedOnInspection?: {
    id: string;
    type: VehicleInspectionRecord["type"];
    typeLabel: string;
    finalizedAt?: string | null;
  } | null;
  creator?: { id: string; name: string } | null;
  finalizedAt?: string | null;
  createdAt?: string | null;
  checklist?: Partial<Record<"exterior" | "interior" | "equipment", VehicleInspectionChecklistItem[]>>;
  markers?: Array<{
    id: string;
    sequenceNumber: number;
    panel: VehiclePanelName;
    xPosition: number;
    yPosition: number;
    issueType: VehicleIssueType;
    description: string;
  }>;
  signatures?: Array<{
    id: string;
    signerType: "personnel" | "renter";
    userId?: string | null;
    signerName: string;
    signedAt?: string | null;
  }>;
};

export type VehicleConditionRequestPayload = VehicleConditionFormValues;
export type VehicleConditionUpdateReason =
  | "correction_reinspection"
  | "maintenance_completed"
  | "repair_completed"
  | "refueling_servicing"
  | "issue_discovered"
  | "company_use"
  | "other";
export type VehicleConditionUpdateRequestPayload = VehicleConditionUpdateFormValues;
export type InspectionBodyMarker = VehicleBodyMarker;
