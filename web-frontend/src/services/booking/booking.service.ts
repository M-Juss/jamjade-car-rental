import { apiGet, apiPost } from "@/services/http";
import type { BookingRecord, DriverCandidate, GeofenceTemplate } from "./types";
import type { VehicleConditionFormValues } from "@/validations/vehicle/schemas";
import { toConditionRequest } from "@/services/vehicle/vehicle.service";

export type BookingGroup = "booking" | "history";

export async function getBookings(filters: {
  group: BookingGroup;
  page: number;
  search: string;
  status: string;
  paymentStatus: string;
}) {
  const params = new URLSearchParams({ group: filters.group, page: String(filters.page) });
  if (filters.search) params.set("search", filters.search);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.paymentStatus !== "all") params.set("payment_status", filters.paymentStatus);

  const response = await apiGet<BookingRecord[]>(`/admin/bookings?${params.toString()}`);
  return {
    bookings: response.data,
    page: Number(response.meta?.current_page ?? filters.page),
    lastPage: Number(response.meta?.last_page ?? 1),
    total: Number(response.meta?.total ?? response.data.length),
    statusCounts: (response.meta?.status_counts ?? {}) as Record<string, number>,
  };
}

export async function getPendingBookingCount() {
  const response = await apiGet<BookingRecord[]>("/admin/bookings?status=pending&per_page=1");

  return Number(response.meta?.total ?? response.data.length);
}

export async function cancelBooking(booking: BookingRecord) {
  const response = await apiPost<BookingRecord>(
    `/admin/bookings/${booking.backendId}/cancel`,
    { reason: "Cancelled by admin." },
  );

  return response.data;
}

export async function getBooking(booking: BookingRecord | number) {
  const id = typeof booking === "number" ? booking : booking.backendId;
  return (await apiGet<BookingRecord>(`/admin/bookings/${id}`)).data;
}

async function bookingAction(booking: BookingRecord, action: "start" | "returned" | "complete" | "finalize-return-charges") {
  return (await apiPost<BookingRecord>(`/admin/bookings/${booking.backendId}/${action}`, {})).data;
}

export const startRental = (booking: BookingRecord) => bookingAction(booking, "start");
export const markBookingReturned = (booking: BookingRecord) => bookingAction(booking, "returned");
export const completeBooking = (booking: BookingRecord) => bookingAction(booking, "complete");
export const finalizeReturnCharges = (booking: BookingRecord) => bookingAction(booking, "finalize-return-charges");

export async function startTelematicsHandover(booking: BookingRecord) {
  const response = await apiPost<BookingRecord>(
    `/admin/bookings/${booking.backendId}/telematics-setup/start`,
    {},
  );

  return response.data;
}

export async function getGeofenceTemplates() {
  const response = await apiGet<{ geofences: GeofenceTemplate[] }>("/admin/bookings/geofence-templates");
  return response.data.geofences;
}

export async function assignBookingGeofence(booking: BookingRecord, payload: {
  source_geofence_id?: number;
  name?: string;
  geometry_type?: "circle" | "polygon";
  center_latitude?: number;
  center_longitude?: number;
  radius_meters?: number;
  polygon_coordinates?: Array<{ latitude: number; longitude: number }>;
}) {
  return (await apiPost<BookingRecord>(`/admin/bookings/${booking.backendId}/telematics-setup/geofence`, payload)).data;
}

export async function finalizeBookingInspection(
  booking: BookingRecord,
  type: "outgoing" | "incoming",
  condition: VehicleConditionFormValues,
  operatorSignatureData: string,
) {
  await apiPost(`/admin/bookings/${booking.backendId}/${type}-inspection`, {
    condition: toConditionRequest(condition),
    operator_signature_data: operatorSignatureData,
  });
  return getBooking(booking);
}

export type AdditionalChargePayload = {
  type: string;
  description: string;
  amount: string;
  responsibility?: "customer" | "driver";
};

export async function addAdditionalCharges(booking: BookingRecord, charges: AdditionalChargePayload[]) {
  await apiPost(`/admin/bookings/${booking.backendId}/additional-charges`, {
    charges: charges.map((charge) => ({
      type: charge.type,
      description: charge.description,
      amount: Number(charge.amount),
      responsibility: booking.driverOption === "self_drive" ? "customer" : charge.responsibility,
    })),
  });
  return getBooking(booking);
}

export async function getDrivers() {
  const response = await apiGet<{ drivers: DriverCandidate[] }>(
    "/admin/bookings/drivers",
  );

  return response.data.drivers;
}

export async function assignDriver(booking: BookingRecord, driverId: number) {
  const response = await apiPost<BookingRecord>(
    `/admin/bookings/${booking.backendId}/assign-driver`,
    { driver_id: driverId },
  );

  return response.data;
}
