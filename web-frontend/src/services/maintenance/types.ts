import type { VehicleInspectionRecord } from "@/services/vehicle";

export type MaintenanceCategory = "preventive" | "corrective" | "body_repair" | "other";
export type MaintenanceStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type MaintenanceDueStatus = "upcoming" | "due_soon" | "due" | "overdue";

export type MaintenancePlan = {
  id: string;
  vehicleId: string;
  vehicle?: { id: string; name: string; plateNumber: string | null };
  name: string;
  category: MaintenanceCategory;
  categoryLabel: string;
  description?: string | null;
  triggerType: "mileage" | "date" | "both";
  intervalKm?: number | null;
  intervalDays?: number | null;
  baselineOdometer?: number | null;
  baselineDate?: string | null;
  lastCompletedAt?: string | null;
  lastCompletedOdometer?: number | null;
  nextDueDate?: string | null;
  nextDueOdometer?: number | null;
  currentOdometer?: number | null;
  dueStatus: MaintenanceDueStatus;
  dueStatusLabel: string;
  mileageRemaining?: number | null;
  daysRemaining?: number | null;
  isActive: boolean;
  hasHistory?: boolean | null;
  activeRecord?: { id: string; status: "scheduled" | "in_progress"; statusLabel: string } | null;
};

type MaintenanceActor = { id: string; name: string };

export type MaintenanceRecord = {
  id: string;
  vehicleId: string;
  vehicle?: { id: string; name: string; plateNumber: string | null; status: string; currentOdometer?: number | null };
  plan?: MaintenancePlan | null;
  category: MaintenanceCategory;
  categoryLabel: string;
  title: string;
  description?: string | null;
  status: MaintenanceStatus;
  statusLabel: string;
  scheduledStart: string;
  scheduledEnd: string;
  actualStartedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  odometerAtStart?: number | null;
  odometerAtCompletion?: number | null;
  serviceProvider?: string | null;
  laborCost: number;
  partsCost: number;
  otherCost: number;
  totalCost: number;
  workPerformed?: string | null;
  notes?: string | null;
  cancellationReason?: string | null;
  conditionVerificationRequired: boolean;
  completionDetailsRecordedAt?: string | null;
  createdBy?: MaintenanceActor | null;
  startedBy?: MaintenanceActor | null;
  completedBy?: MaintenanceActor | null;
  cancelledBy?: MaintenanceActor | null;
  resultingConditionInspectionId?: string | null;
  resultingCondition?: VehicleInspectionRecord | null;
  createdAt: string;
};

export type MaintenanceSummary = {
  dueSoon: number;
  overdue: number;
  scheduled: number;
  inProgress: number;
};
