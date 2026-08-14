import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "@/services/http";
import type {
  CompleteMaintenanceFormValues,
  MaintenancePlanFormValues,
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
  nextDueOdometer: "",
  nextDueDate: "",
};

export const scheduleMaintenanceDefaults: ScheduleMaintenanceFormValues = {
  vehicleId: "",
  planId: "",
  title: "",
  category: "preventive",
  scheduledStart: "",
  scheduledEnd: "",
  serviceProvider: "",
  technician: "",
  description: "",
  notes: "",
};

export const completeMaintenanceDefaults: CompleteMaintenanceFormValues = {
  odometerAtCompletion: "",
  workPerformed: "",
  serviceProvider: "",
  technician: "",
  laborCost: "",
  partsCost: "",
  otherCost: "",
  notes: "",
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
