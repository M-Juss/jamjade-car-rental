import { apiGet, apiPost, apiPut } from "@/services/http";
import type { CompleteMaintenanceFormValues, MaintenancePlanFormValues, ScheduleMaintenanceFormValues } from "@/validations/maintenance/schemas";
import type { MaintenancePlan, MaintenanceRecord, MaintenanceSummary } from "./types";
import type { VehicleRecord } from "@/services/vehicle";

const nullableNumber = (value?: string) => value ? Number(value) : null;
const nullableText = (value?: string) => value?.trim() || null;

export async function getMaintenanceRecords(vehicleId?: string) {
  const query = vehicleId ? `?vehicle_id=${encodeURIComponent(vehicleId)}&per_page=100` : "?per_page=100";
  return (await apiGet<MaintenanceRecord[]>(`/admin/maintenance${query}`)).data;
}
export async function getMaintenancePlans(vehicleId?: string) {
  const path = vehicleId ? `/admin/vehicles/${vehicleId}/maintenance-plans` : "/admin/maintenance-plans";
  return (await apiGet<MaintenancePlan[]>(path)).data;
}
export async function getMaintenanceSummary() { return (await apiGet<MaintenanceSummary>("/admin/maintenance/summary")).data; }
export async function getMaintenanceVehicles() { return (await apiGet<VehicleRecord[]>("/admin/maintenance/vehicles")).data; }
export async function createMaintenancePlan(values: MaintenancePlanFormValues) {
  return (await apiPost<MaintenancePlan>("/admin/maintenance-plans", {
    vehicle_id: Number(values.vehicleId), name: values.name, category: values.category,
    description: nullableText(values.description), trigger_type: values.triggerType,
    interval_km: values.triggerType === "date" ? null : nullableNumber(values.intervalKm),
    interval_days: values.triggerType === "mileage" ? null : nullableNumber(values.intervalDays),
    next_due_odometer: values.triggerType === "date" ? null : nullableNumber(values.nextDueOdometer),
    next_due_date: values.triggerType === "mileage" ? null : values.nextDueDate,
  })).data;
}
export async function updateMaintenancePlan(planId: string, values: MaintenancePlanFormValues) {
  return (await apiPut<MaintenancePlan>(`/admin/maintenance-plans/${planId}`, {
    name: values.name, category: values.category, description: nullableText(values.description), trigger_type: values.triggerType,
    interval_km: values.triggerType === "date" ? null : nullableNumber(values.intervalKm), interval_days: values.triggerType === "mileage" ? null : nullableNumber(values.intervalDays),
    next_due_odometer: values.triggerType === "date" ? null : nullableNumber(values.nextDueOdometer), next_due_date: values.triggerType === "mileage" ? null : values.nextDueDate,
  })).data;
}
export async function deactivateMaintenancePlan(planId: string) { return (await apiPost<MaintenancePlan>(`/admin/maintenance-plans/${planId}/deactivate`)).data; }
export async function scheduleMaintenance(values: ScheduleMaintenanceFormValues) {
  return (await apiPost<MaintenanceRecord>("/admin/maintenance", {
    vehicle_id: Number(values.vehicleId), maintenance_plan_id: values.planId ? Number(values.planId) : null,
    title: values.planId ? null : nullableText(values.title), category: values.planId ? null : values.category,
    scheduled_start: new Date(values.scheduledStart).toISOString(), scheduled_end: new Date(values.scheduledEnd).toISOString(),
    service_provider: nullableText(values.serviceProvider), technician: nullableText(values.technician),
    description: nullableText(values.description), notes: nullableText(values.notes),
  })).data;
}
export async function startMaintenance(recordId: string) {
  return (await apiPost<MaintenanceRecord>(`/admin/maintenance/${recordId}/start`)).data;
}
export async function completeMaintenance(recordId: string, values: CompleteMaintenanceFormValues) {
  return (await apiPost<MaintenanceRecord>(`/admin/maintenance/${recordId}/complete`, {
    odometer_at_completion: Number(values.odometerAtCompletion), work_performed: values.workPerformed,
    service_provider: nullableText(values.serviceProvider), technician: nullableText(values.technician),
    labor_cost: nullableNumber(values.laborCost), parts_cost: nullableNumber(values.partsCost), other_cost: nullableNumber(values.otherCost), notes: nullableText(values.notes),
  })).data;
}
export async function cancelMaintenance(recordId: string) { return (await apiPost<MaintenanceRecord>(`/admin/maintenance/${recordId}/cancel`)).data; }
export async function linkMaintenanceCondition(recordId: string, inspectionId: string) {
  return (await apiPost<MaintenanceRecord>(`/admin/maintenance/${recordId}/condition`, { inspection_id: Number(inspectionId) })).data;
}
