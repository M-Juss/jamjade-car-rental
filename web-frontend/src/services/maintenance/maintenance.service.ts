import { apiDelete, apiGet, apiPost, apiPut } from "@/services/http";
import {
  toConditionRequest,
  type VehicleConditionUpdateRequestPayload,
  type VehicleInspectionRecord,
  type VehicleRecord,
} from "@/services/vehicle";
import type {
  CancelMaintenanceFormValues,
  CompleteMaintenanceFormValues,
  MaintenancePlanFormValues,
  RescheduleMaintenanceFormValues,
  ScheduleMaintenanceFormValues,
} from "@/validations/maintenance/schemas";
import type { MaintenancePlan, MaintenanceRecord, MaintenanceSummary } from "./types";

const nullableNumber = (value?: string) => value ? Number(value) : null;
const nullableText = (value?: string) => value?.trim() || null;

function dateBoundary(value: string, endOfDay = false) {
  return new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`).toISOString();
}

export async function getMaintenanceRecords(vehicleId?: string) {
  const query = vehicleId ? `?vehicle_id=${encodeURIComponent(vehicleId)}&per_page=100` : "?per_page=100";
  return (await apiGet<MaintenanceRecord[]>(`/admin/maintenance${query}`)).data;
}

export async function getMaintenancePlans(vehicleId?: string) {
  const path = vehicleId ? `/admin/vehicles/${vehicleId}/maintenance-plans` : "/admin/maintenance-plans";
  return (await apiGet<MaintenancePlan[]>(path)).data;
}

export async function getMaintenanceSummary() {
  return (await apiGet<MaintenanceSummary>("/admin/maintenance/summary")).data;
}

export async function getMaintenanceVehicles() {
  return (await apiGet<VehicleRecord[]>("/admin/maintenance/vehicles")).data;
}

export async function createMaintenancePlan(values: MaintenancePlanFormValues) {
  return (await apiPost<MaintenancePlan>("/admin/maintenance-plans", {
    vehicle_id: Number(values.vehicleId),
    name: values.name,
    category: values.category,
    description: nullableText(values.description),
    trigger_type: values.triggerType,
    interval_km: values.triggerType === "date" ? null : nullableNumber(values.intervalKm),
    interval_days: values.triggerType === "mileage" ? null : nullableNumber(values.intervalDays),
  })).data;
}

export async function updateMaintenancePlan(planId: string, values: MaintenancePlanFormValues) {
  return (await apiPut<MaintenancePlan>(`/admin/maintenance-plans/${planId}`, {
    name: values.name,
    category: values.category,
    description: nullableText(values.description),
    trigger_type: values.triggerType,
    interval_km: values.triggerType === "date" ? null : nullableNumber(values.intervalKm),
    interval_days: values.triggerType === "mileage" ? null : nullableNumber(values.intervalDays),
  })).data;
}

export async function deleteMaintenancePlan(planId: string) {
  return (await apiDelete<{ deleted: boolean; archived: boolean }>(`/admin/maintenance-plans/${planId}`)).data;
}

export async function scheduleMaintenance(values: ScheduleMaintenanceFormValues) {
  return (await apiPost<MaintenanceRecord>("/admin/maintenance", {
    vehicle_id: Number(values.vehicleId),
    maintenance_plan_id: values.planId ? Number(values.planId) : null,
    title: values.planId ? null : nullableText(values.title),
    category: values.planId ? null : values.category,
    scheduled_start: dateBoundary(values.scheduledStart),
    scheduled_end: dateBoundary(values.scheduledEnd, true),
    service_provider: nullableText(values.serviceProvider),
    description: nullableText(values.description),
    notes: nullableText(values.notes),
  })).data;
}

export async function rescheduleMaintenance(recordId: string, values: RescheduleMaintenanceFormValues) {
  return (await apiPut<MaintenanceRecord>(`/admin/maintenance/${recordId}/reschedule`, {
    scheduled_start: dateBoundary(values.scheduledStart),
    scheduled_end: dateBoundary(values.scheduledEnd, true),
  })).data;
}

export async function startMaintenance(recordId: string) {
  return (await apiPost<MaintenanceRecord>(`/admin/maintenance/${recordId}/start`)).data;
}

export async function completeMaintenance(recordId: string, values: CompleteMaintenanceFormValues) {
  return (await apiPost<MaintenanceRecord>(`/admin/maintenance/${recordId}/complete`, {
    odometer_at_completion: nullableNumber(values.odometerAtCompletion),
    work_performed: values.workPerformed,
    service_provider: nullableText(values.serviceProvider),
    labor_cost: nullableNumber(values.laborCost),
    parts_cost: nullableNumber(values.partsCost),
    other_cost: nullableNumber(values.otherCost),
    notes: nullableText(values.notes),
    condition_changed: values.conditionChanged ? values.conditionChanged === "yes" : null,
  })).data;
}

export async function cancelMaintenance(recordId: string, values: CancelMaintenanceFormValues) {
  return (await apiPost<MaintenanceRecord>(`/admin/maintenance/${recordId}/cancel`, {
    reason: nullableText(values.reason),
  })).data;
}

export async function getMaintenanceCompletionCondition(recordId: string) {
  return (await apiGet<VehicleInspectionRecord>(
    `/admin/maintenance/${recordId}/completion-condition`,
  )).data;
}

export async function finalizeMaintenanceCondition(
  recordId: string,
  payload: VehicleConditionUpdateRequestPayload,
) {
  return (await apiPost<MaintenanceRecord>(
    `/admin/maintenance/${recordId}/completion-condition`,
    {
      reason: payload.reason,
      notes: payload.notes || null,
      condition: toConditionRequest(payload.condition),
    },
  )).data;
}

export async function linkMaintenanceCondition(recordId: string, inspectionId: string) {
  return (await apiPost<MaintenanceRecord>(`/admin/maintenance/${recordId}/condition`, {
    inspection_id: Number(inspectionId),
  })).data;
}
