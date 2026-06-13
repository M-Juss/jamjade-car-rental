import { API_BASE_URL, apiDelete, apiGet, apiPost, apiPut } from "@/services/http";
import type { CreateVehicleRequestPayload, VehicleRecord, VehicleStatus } from "./types";

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

  return formData;
}

function resolveVehicleImageUrl(url?: string | null) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;

  return `${API_BASE_URL}/${url.replace(/^\/+/, "")}`;
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
