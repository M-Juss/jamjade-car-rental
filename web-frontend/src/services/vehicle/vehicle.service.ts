import { apiDelete, apiGet, apiPost, apiPut, resolveAssetUrl } from "@/services/http";
import type {
  CreateVehicleRequestPayload,
  VehicleConditionRequestPayload,
  VehicleConditionUpdateRequestPayload,
  VehicleInspectionRecord,
  VehicleRecord,
  ShowcaseVehicle,
  VehicleStatus,
} from "./types";

export const DEFAULT_VEHICLE_STATUS: VehicleStatus = "available";

function appendIfPresent(formData: FormData, key: string, value?: string | number | null) {
  if (value === undefined || value === null || value === "") return;

  formData.append(key, String(value));
}

function toVehicleFormData(payload: CreateVehicleRequestPayload) {
  const formData = new FormData();

  appendIfPresent(formData, "name", payload.name);
  appendIfPresent(formData, "brand", payload.brand);
  appendIfPresent(formData, "model", payload.model);
  appendIfPresent(formData, "description", payload.description);
  appendIfPresent(formData, "price_per_day", payload.price_per_day);
  appendIfPresent(formData, "seats", payload.seats);
  appendIfPresent(formData, "color", payload.color);
  appendIfPresent(formData, "transmission", payload.transmission);
  appendIfPresent(formData, "fuel_type", payload.fuel_type);
  appendIfPresent(formData, "status", payload.status ?? DEFAULT_VEHICLE_STATUS);

  payload.features.forEach((feature) => {
    formData.append("features[]", feature);
  });

  payload.images.forEach((image) => {
    formData.append("images[]", image);
  });

  appendIfPresent(formData, "initial_condition[odometer]", payload.initial_condition.odometer);
  appendIfPresent(formData, "initial_condition[fuel_level]", payload.initial_condition.fuel_level);
  appendIfPresent(formData, "initial_condition[comments]", payload.initial_condition.comments);
  formData.append("initial_condition[signature_data]", payload.initial_condition.signature_data);

  Object.entries(payload.initial_condition.checklist).forEach(([category, items]) => {
    Object.entries(items).forEach(([key, value]) => {
      formData.append(
        `initial_condition[checklist][${category}][${key}]`,
        value ? "1" : "0",
      );
    });
  });

  payload.initial_condition.markers.forEach((marker, index) => {
    const prefix = `initial_condition[markers][${index}]`;
    formData.append(`${prefix}[sequence_number]`, String(marker.sequenceNumber));
    formData.append(`${prefix}[panel]`, marker.panel);
    formData.append(`${prefix}[x_position]`, marker.xPosition.toFixed(3));
    formData.append(`${prefix}[y_position]`, marker.yPosition.toFixed(3));
    formData.append(`${prefix}[issue_type]`, marker.issueType);
    formData.append(`${prefix}[description]`, marker.description);
  });

  return formData;
}

export function toConditionRequest(condition: VehicleConditionRequestPayload) {
  return {
    odometer: Number(condition.odometer),
    fuel_level: condition.fuel_level,
    comments: condition.comments || null,
    checklist: condition.checklist,
    markers: condition.markers.map((marker) => ({
      sequence_number: marker.sequenceNumber,
      panel: marker.panel,
      x_position: marker.xPosition,
      y_position: marker.yPosition,
      issue_type: marker.issueType,
      description: marker.description,
    })),
    signature_data: condition.signature_data,
  };
}

function resolveVehicleImageUrl(url?: string | null) {
  return resolveAssetUrl(url);
}

function normalizeVehicle(record: VehicleRecord): VehicleRecord {
  const images = (record.images ?? [])
    .map(resolveVehicleImageUrl)
    .filter((url): url is string => Boolean(url));

  const imageRecords = record.imageRecords?.map((image) => ({
    ...image,
    url: resolveVehicleImageUrl(image.url),
  }));

  return {
    ...record,
    images,
    imageRecords,
    image: resolveVehicleImageUrl(record.image) ?? images[0] ?? null,
  };
}

export async function getVehicles() {
  const response = await apiGet<VehicleRecord[]>("/admin/vehicles?per_page=100");

  return response.data.map(normalizeVehicle);
}

export async function getAvailableShowcaseVehicles() {
  const response = await apiGet<ShowcaseVehicle[]>("/api/mobile/vehicles?status=available&per_page=12");

  return response.data.map((vehicle) => ({
    ...vehicle,
    image: resolveVehicleImageUrl(vehicle.image),
    cardImage: resolveVehicleImageUrl(vehicle.cardImage),
    images: (vehicle.images ?? [])
      .map(resolveVehicleImageUrl)
      .filter((url): url is string => Boolean(url)),
  }));
}

export async function getVehicle(vehicleId: string) {
  const response = await apiGet<VehicleRecord>(`/admin/vehicles/${vehicleId}`);

  return normalizeVehicle(response.data);
}

export async function createVehicle(payload: CreateVehicleRequestPayload) {
  const response = await apiPost<VehicleRecord>("/admin/vehicles", toVehicleFormData(payload));

  return normalizeVehicle(response.data);
}

export async function updateVehicle(vehicleId: string, payload: Partial<CreateVehicleRequestPayload>) {
  const response = await apiPut<VehicleRecord>(`/admin/vehicles/${vehicleId}`, payload);

  return normalizeVehicle(response.data);
}

export async function deleteVehicle(vehicleId: string) {
  await apiDelete<null>(`/admin/vehicles/${vehicleId}`);
}

export async function getCurrentVehicleCondition(vehicleId: string) {
  const response = await apiGet<VehicleInspectionRecord | null>(
    `/admin/vehicles/${vehicleId}/current-condition`,
  );
  return response.data;
}

export async function getVehicleInspectionHistory(vehicleId: string) {
  const response = await apiGet<VehicleInspectionRecord[]>(
    `/admin/vehicles/${vehicleId}/inspections`,
  );
  return response.data;
}

export async function getVehicleInspection(vehicleId: string, inspectionId: string) {
  const response = await apiGet<VehicleInspectionRecord>(
    `/admin/vehicles/${vehicleId}/inspections/${inspectionId}`,
  );
  return response.data;
}

export async function setInitialVehicleCondition(
  vehicleId: string,
  condition: VehicleConditionRequestPayload,
) {
  const response = await apiPost<VehicleInspectionRecord>(
    `/admin/vehicles/${vehicleId}/initial-condition`,
    { condition: toConditionRequest(condition) },
  );
  return response.data;
}

export async function updateCurrentVehicleCondition(
  vehicleId: string,
  payload: VehicleConditionUpdateRequestPayload,
) {
  const response = await apiPost<VehicleInspectionRecord>(
    `/admin/vehicles/${vehicleId}/condition-updates`,
    {
      reason: payload.reason,
      notes: payload.notes || null,
      condition: toConditionRequest(payload.condition),
    },
  );
  return response.data;
}
