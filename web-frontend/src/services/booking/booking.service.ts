import { apiGet, apiPost } from "@/services/http";
import type { BookingRecord, DriverCandidate } from "./types";
import type { VehicleConditionFormValues } from "@/validations/vehicle/schemas";
import { toConditionRequest } from "@/services/vehicle/vehicle.service";

export async function getBookings() {
  const bookings: BookingRecord[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const response = await apiGet<BookingRecord[]>(
      `/admin/bookings?per_page=100&page=${page}`,
    );

    bookings.push(...response.data);
    lastPage = Number(response.meta?.last_page ?? 1);
    page += 1;
  } while (page <= lastPage);

  return bookings;
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
