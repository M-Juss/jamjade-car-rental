import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "@/services/http";
import type { MaintenancePlan } from "@/services/maintenance";
import { maintenanceDateKey } from "@/services/maintenance/dates";
import type {
  CancelMaintenanceFormValues,
  CompleteMaintenanceFormValues,
  MaintenancePlanFormValues,
  RescheduleMaintenanceFormValues,
  ScheduleMaintenanceFormValues,
} from "@/validations/maintenance/schemas";

export const maintenanceCategoryOptions = [
  { value: "preventive", label: "Preventive" },
  { value: "corrective", label: "Corrective" },
  { value: "body_repair", label: "Body Repair" },
  { value: "other", label: "Other" },
] as const;

export const maintenanceTriggerOptions = [
  { value: "mileage", label: "Mileage" },
  { value: "date", label: "Date" },
  { value: "both", label: "Mileage and date" },
] as const;

export const maintenancePlanDefaults: MaintenancePlanFormValues = {
  vehicleId: "",
  name: "",
  category: "preventive",
  description: "",
  triggerType: "mileage",
  intervalKm: "",
  intervalDays: "",
};

export function getMaintenancePlanPreview({
  currentOdometer,
  editingPlan,
  intervalKm = "",
  intervalDays = "",
  today = new Date(),
}: {
  currentOdometer: number | null;
  editingPlan?: Pick<MaintenancePlan,
    "lastCompletedOdometer" | "baselineOdometer" | "lastCompletedAt" | "baselineDate">;
  intervalKm?: string;
  intervalDays?: string;
  today?: Date;
}) {
  const dateFormatter = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });
  const dateParts = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(today);
  const datePart = (type: Intl.DateTimeFormatPartTypes) => dateParts.find((part) => part.type === type)?.value;
  const todayKey = `${datePart("year")}-${datePart("month")}-${datePart("day")}`;
  const mileageBaseline = editingPlan?.lastCompletedOdometer ?? editingPlan?.baselineOdometer ?? currentOdometer;
  const mileage = Number(intervalKm);
  const nextOdometer = mileageBaseline == null ? NaN : mileageBaseline + mileage;
  const days = Number(intervalDays);
  const baseline = editingPlan?.lastCompletedAt
    ?? `${editingPlan?.baselineDate ?? todayKey}T00:00:00+08:00`;
  const nextDate = new Date(new Date(baseline).getTime() + days * 86_400_000);

  return {
    currentDate: dateFormatter.format(today),
    currentOdometer: currentOdometer == null ? "" : `${currentOdometer.toLocaleString("en-PH")} km`,
    nextDueOdometer: /^\d+$/.test(intervalKm) && mileage >= 1 && Number.isSafeInteger(nextOdometer)
      ? `${nextOdometer.toLocaleString("en-PH")} km`
      : "",
    nextDueDate: /^\d+$/.test(intervalDays) && days >= 1 && Number.isSafeInteger(days) && Number.isFinite(nextDate.getTime())
      ? dateFormatter.format(nextDate)
      : "",
  };
}

export const scheduleMaintenanceDefaults: ScheduleMaintenanceFormValues = {
  vehicleId: "",
  planId: "",
  title: "",
  category: "preventive",
  scheduledStart: "",
  scheduledEnd: "",
  serviceProvider: "",
  description: "",
  notes: "",
};

export function getMaintenanceScheduleDateLimits(scheduledStart = "", now = new Date()) {
  const today = maintenanceDateKey(now);

  return {
    start: today,
    end: scheduledStart > today ? scheduledStart : today,
  };
}

export const completeMaintenanceDefaults: CompleteMaintenanceFormValues = {
  odometerAtCompletion: "",
  serviceProvider: "",
  laborCost: "",
  partsCost: "",
  otherCost: "",
  notes: "",
  conditionChanged: undefined,
};

export const rescheduleMaintenanceDefaults: RescheduleMaintenanceFormValues = {
  scheduledStart: "",
  scheduledEnd: "",
};

export const cancelMaintenanceDefaults: CancelMaintenanceFormValues = {
  reason: "",
};

export function applyMaintenanceServerErrors<TValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TValues>,
  fieldMap: Record<string, Path<TValues>>,
) {
  if (!(error instanceof ApiError) || !error.errors) return false;

  let mappedAnyError = false;

  Object.entries(error.errors).forEach(([serverField, messages]) => {
    const field = fieldMap[serverField];
    const message = messages[0];

    if (field && message) {
      setError(field, { message, type: "server" });
      mappedAnyError = true;
    }
  });

  return mappedAnyError;
}
