import { apiGet, apiPost } from "@/services/http";
import type { BookingRecord, DriverCandidate } from "./types";

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
