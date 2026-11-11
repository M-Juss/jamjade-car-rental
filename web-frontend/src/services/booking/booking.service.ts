import { drivingAnalysisQuerySchema } from "@/validations/driving-analysis/schemas";
import { refreshManagementCounts } from "@/services/management/navigation.service";
import { TABLE_PAGE_SIZE } from "@/lib/table-pagination";
import { apiDelete, apiGet, apiPost, apiPut } from "@/services/http";
import type { BookingRecord, DriverCandidate } from "./types";
import type { RentalDrivingEvents, RentalDrivingGrade } from "@/services/fleet/fleet.service";
import type { VehicleConditionFormValues } from "@/validations/vehicle/schemas";
import { toConditionRequest } from "@/services/vehicle/vehicle.service";

export type BookingGroup = "booking" | "history";

export async function getBookings(filters: {
  group: BookingGroup;
  page: number;
  search: string;
  status: string;
  paymentStatus: string;
  attention?: string;
}) {
  const params = new URLSearchParams({ group: filters.group, page: String(filters.page), per_page: String(TABLE_PAGE_SIZE) });
  if (filters.search) params.set("search", filters.search);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.paymentStatus !== "all") params.set("payment_status", filters.paymentStatus);

  if (filters.attention && filters.attention !== "all") params.set("attention", filters.attention);

  const response = await apiGet<BookingRecord[]>(`/admin/bookings?${params.toString()}`);
  return {
    attentionCounts: (response.meta?.attention_counts ?? {}) as Record<string, number>,
    bookings: response.data,
    page: Number(response.meta?.current_page ?? filters.page),
    lastPage: Number(response.meta?.last_page ?? 1),
    total: Number(response.meta?.total ?? response.data.length),
    statusCounts: (response.meta?.status_counts ?? {}) as Record<string, number>,
  };
}

export async function cancelBooking(booking: BookingRecord, reason: string) {
  const response = await apiPost<BookingRecord>(
    `/admin/bookings/${booking.backendId}/cancel`,
    { reason },
  );

  refreshManagementCounts();
  return response.data;
}

export async function getBooking(booking: BookingRecord | number) {
  const id = typeof booking === "number" ? booking : booking.backendId;
  return (await apiGet<BookingRecord>(`/admin/bookings/${id}`)).data;
}

export type DrivingAnalysisSummary = {
  completed_rentals: number; operators_monitored: number;
  average_score: number | null; harsh_events: number;
};
export type DrivingOperator = {
  id: number; name: string | null; completed_rentals: number; monitored_rentals: number;
  average_score: number | null; latest_score: number | null; harsh_events: number;
};
export type DrivingVehicleOption = { value: string; label: string };
export type RecordedOperator = { id: number | null; name: string | null };

type DrivingAnalysisFilters = { page: number; search: string; operatorId?: string | null; vehicleId?: string | null };
function drivingAnalysisParams(filters: DrivingAnalysisFilters) {
  const values = drivingAnalysisQuerySchema.parse({ page: filters.page, search: filters.search,
    per_page: TABLE_PAGE_SIZE, operator_id: filters.operatorId, vehicle_id: filters.vehicleId });
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  return params;
}

export async function getDrivingOperators(filters: DrivingAnalysisFilters) {
  const response = await apiGet<DrivingOperator[]>(`/admin/driving-analysis/operators?${drivingAnalysisParams(filters)}`);
  return { operators: response.data, vehicleOptions: (response.meta?.vehicle_options ?? []) as DrivingVehicleOption[], summary: response.meta?.summary as DrivingAnalysisSummary,
    total: Number(response.meta?.total ?? 0), lastPage: Number(response.meta?.last_page ?? 1) };
}

export async function getDrivingAnalysisBookings(filters: DrivingAnalysisFilters) {
  const params = drivingAnalysisParams(filters);
  const response = await apiGet<BookingRecord[]>(`/admin/driving-analysis?${params}`);
  return {
    bookings: response.data,
    grades: (response.meta?.driving_grades ?? {}) as Record<string, RentalDrivingGrade>,
    vehicleOptions: (response.meta?.vehicle_options ?? []) as DrivingVehicleOption[],
    recordedOperators: (response.meta?.recorded_operators ?? {}) as Record<string, RecordedOperator>,
    operatorFilter: (response.meta?.operator_filter ?? null) as RecordedOperator | null,
    summary: response.meta?.summary as DrivingAnalysisSummary,
    total: Number(response.meta?.total ?? 0),
    lastPage: Number(response.meta?.last_page ?? 1),
  };
}

export function getBookingDrivingAnalysis(bookingId: number, signal?: AbortSignal) {
  return apiGet<RentalDrivingEvents>(`/admin/bookings/${bookingId}/driving-analysis`, { signal });
}

async function bookingAction(booking: BookingRecord, action: "start" | "complete" | "finalize-return") {
  const response = await apiPost<BookingRecord>(`/admin/bookings/${booking.backendId}/${action}`, {});
  refreshManagementCounts();
  return response.data;
}

export const startRental = (booking: BookingRecord) => bookingAction(booking, "start");
export const completeBooking = (booking: BookingRecord) => bookingAction(booking, "complete");
export const finalizeBookingReturn = (booking: BookingRecord) => bookingAction(booking, "finalize-return");

export async function startTelematicsHandover(booking: BookingRecord) {
  const response = await apiPost<BookingRecord>(
    `/admin/bookings/${booking.backendId}/telematics-setup/start`,
    {},
  );

  return response.data;
}

export async function finalizeBookingInspection(
  booking: BookingRecord,
  type: "outgoing" | "incoming",
  condition: VehicleConditionFormValues,
  operatorSignatureData: string,
) {
  const action = type === "outgoing" && booking.driverOption === "self_drive"
    ? "outgoing-inspection-handover" : `${type}-inspection`;
  await apiPost(`/admin/bookings/${booking.backendId}/${action}`, {
    condition: toConditionRequest(condition),
    operator_signature_data: operatorSignatureData,
  });
}

export type AdditionalChargePayload = {
  type: string;
  description: string;
  amount: string;
  responsibility?: "customer" | "driver" | null;
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
}

export async function updateAdditionalCharge(booking: BookingRecord, chargeId: string, charge: AdditionalChargePayload) {
  await apiPut(`/admin/bookings/${booking.backendId}/additional-charges/${chargeId}`, {
    charges: [{ ...charge, amount: Number(charge.amount), responsibility: booking.driverOption === "self_drive" ? "customer" : charge.responsibility }],
  });
}

export async function deleteAdditionalCharge(booking: BookingRecord, chargeId: string) {
  await apiDelete(`/admin/bookings/${booking.backendId}/additional-charges/${chargeId}`);
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

export async function receiveVehicle(booking: BookingRecord, receivedAt: string) {
  return (await apiPost<BookingRecord>(`/admin/bookings/${booking.backendId}/receive-vehicle`, { vehicle_received_at: receivedAt })).data;
}
export async function reviewLateCharge(booking: BookingRecord, data: { amount: number; adjustment_reason: string; responsibility: "customer" | "driver" }) {
  return (await apiPost<BookingRecord>(`/admin/bookings/${booking.backendId}/review-late-charge`, data)).data;
}
export async function saveReturnFollowUp(booking: BookingRecord, note: string, expectedReturnAt: string | null) {
  return (await apiPost<BookingRecord>(`/admin/bookings/${booking.backendId}/return-follow-up`, { note, expected_return_at: expectedReturnAt })).data;
}

export async function recordBookingNoShow(booking: BookingRecord, reason: string) {
  const response = await apiPost<BookingRecord>(`/admin/bookings/${booking.backendId}/no-show`, { reason });
  refreshManagementCounts();
  return response.data;
}
export async function reviewCancellationRefund(booking: BookingRecord, values: { amount: string; reason: string }) {
  return (await apiPost<BookingRecord>(`/admin/bookings/${booking.backendId}/refund-review`, { amount: Number(values.amount), reason: values.reason })).data;
}
export async function recordCancellationRefund(booking: BookingRecord, confirmed: boolean) {
  return (await apiPost<BookingRecord>(`/admin/bookings/${booking.backendId}/record-refund`, { confirmed })).data;
}
