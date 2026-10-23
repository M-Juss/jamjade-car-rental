import { apiDelete, apiGet, apiPost, apiPut } from "@/services/http";
import type { GeofenceTemplateFormValues } from "@/validations/geofence/schemas";
import type { GeofenceRecord } from "./types";

function payload(values: GeofenceTemplateFormValues) {
  return {
    name: values.name.trim(),
    notify_on_enter: true,
    notify_on_exit: true,
    geometry_type: values.geometryType,
    center_latitude: values.geometryType === "circle" ? Number(values.centerLatitude) : null,
    center_longitude: values.geometryType === "circle" ? Number(values.centerLongitude) : null,
    radius_meters: values.geometryType === "circle" ? Number(values.radiusMeters) : null,
    polygon_coordinates: values.geometryType === "polygon"
      ? values.polygonCoordinates.map((point) => ({ latitude: Number(point.latitude), longitude: Number(point.longitude) }))
      : null,
  };
}

export async function getGeofences(includeDeleted = false) {
  return (await apiGet<GeofenceRecord[]>(`/admin/geofences${includeDeleted ? "?include_deleted=true" : ""}`)).data;
}

export async function createGeofence(values: GeofenceTemplateFormValues) {
  return (await apiPost<GeofenceRecord>("/admin/geofences", payload(values))).data;
}

export async function updateGeofence(id: string, values: GeofenceTemplateFormValues) {
  return (await apiPut<GeofenceRecord>(`/admin/geofences/${id}`, payload(values))).data;
}

export async function setGeofenceActive(id: string, active: boolean) {
  return (await apiPost<GeofenceRecord>(`/admin/geofences/${id}/${active ? "activate" : "deactivate"}`, {})).data;
}

export async function deleteGeofence(id: string) {
  return (await apiDelete<{ id: string; isDeleted: boolean }>(`/admin/geofences/${id}`)).data;
}

export async function saveBookingMonitoringZone(bookingId: number, values: GeofenceTemplateFormValues, zoneId?: string) {
  const url = `/admin/bookings/${bookingId}/monitoring-zones`;
  if (zoneId) return (await apiPut(`${url}/${zoneId}`, payload(values))).data;
  return (await apiPost(url, payload(values))).data;
}

export async function deleteBookingMonitoringZone(bookingId: number, zoneId: string) {
  return (await apiDelete(`/admin/bookings/${bookingId}/monitoring-zones/${zoneId}`)).data;
}
