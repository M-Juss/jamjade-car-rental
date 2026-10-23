import { apiDelete, apiGet, apiPost, apiPut } from "@/services/http";
import type { VehicleOptionValues } from "@/validations/vehicle/configuration";

export const VEHICLE_OPTION_SECTIONS = ["brand", "feature", "transmission", "fuel_type", "exterior", "interior", "equipment"] as const;
export type VehicleOptionSection = (typeof VEHICLE_OPTION_SECTIONS)[number];
export type ChecklistCategory = "exterior" | "interior" | "equipment";
export type ChecklistDefinition = Record<ChecklistCategory, Record<string, string>>;
export type VehicleOptions = {
  options: Record<"brand" | "feature" | "transmission" | "fuel_type", string[]>;
  checklist: ChecklistDefinition;
  checklist_version: string;
};
export type VehicleConfigurationOption = {
  id: number; section: VehicleOptionSection; key: string; name: string; is_active: boolean; in_use: boolean;
};

export async function getVehicleOptions() {
  return (await apiGet<VehicleOptions>("/admin/vehicle-options")).data;
}
export async function getVehicleConfiguration() {
  return (await apiGet<VehicleConfigurationOption[]>("/admin/vehicle-configuration")).data;
}
export async function saveVehicleOption(section: VehicleOptionSection, values: VehicleOptionValues, id?: number) {
  return id
    ? (await apiPut<VehicleConfigurationOption>("/admin/vehicle-configuration/" + id, values)).data
    : (await apiPost<VehicleConfigurationOption>("/admin/vehicle-configuration", { ...values, section })).data;
}
export async function removeVehicleOption(id: number) {
  await apiDelete<null>("/admin/vehicle-configuration/" + id);
}
