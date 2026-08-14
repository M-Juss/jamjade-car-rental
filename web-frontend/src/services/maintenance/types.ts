export type MaintenanceCategory = "preventive" | "corrective" | "body_repair" | "other";
export type MaintenanceStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type MaintenanceDueStatus = "upcoming" | "due_soon" | "due" | "overdue";

export type MaintenancePlan = {
  id: string; vehicleId: string; vehicle?: { id: string; name: string }; name: string;
  category: MaintenanceCategory; categoryLabel: string; description?: string | null;
  triggerType: "mileage" | "date" | "both"; intervalKm?: number | null; intervalDays?: number | null;
  lastCompletedAt?: string | null; lastCompletedOdometer?: number | null; nextDueDate?: string | null;
  nextDueOdometer?: number | null; currentOdometer?: number | null; dueStatus: MaintenanceDueStatus;
  dueStatusLabel: string; mileageRemaining?: number | null; daysRemaining?: number | null; isActive: boolean;
};

export type MaintenanceRecord = {
  id: string; vehicleId: string; vehicle?: { id: string; name: string; status: string; currentOdometer?: number | null };
  plan?: MaintenancePlan | null; category: MaintenanceCategory; categoryLabel: string; title: string;
  description?: string | null; status: MaintenanceStatus; statusLabel: string; scheduledStart: string; scheduledEnd: string;
  actualStartedAt?: string | null; completedAt?: string | null; cancelledAt?: string | null;
  odometerAtStart?: number | null; odometerAtCompletion?: number | null; serviceProvider?: string | null;
  technician?: string | null; laborCost: number; partsCost: number; otherCost: number; totalCost: number;
  workPerformed?: string | null; notes?: string | null; resultingConditionInspectionId?: string | null; createdAt: string;
};

export type MaintenanceSummary = { dueSoon: number; overdue: number; scheduled: number; inProgress: number; completed: number; cancelled: number };
