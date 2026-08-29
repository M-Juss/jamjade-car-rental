import type {
  Booking,
  BookingStatus,
  DriverType,
  PaymentStatus,
} from '@/types/booking';
import { apiGet, apiPost, API_BASE_URL } from '@/services/http';

import type { MobileBookingRecord } from './types';

const backendOrigin = API_BASE_URL.match(/^(https?:\/\/[^/]+)/i)?.[1] ?? '';

function normalizeImageUrl(value?: string | null) {
  const imageUrl = value?.trim();

  if (!imageUrl) {
    return '';
  }

  if (imageUrl.startsWith('/')) {
    return backendOrigin ? `${backendOrigin}${imageUrl}` : imageUrl;
  }

  const localUrl = imageUrl.match(
    /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(\/.*)$/i,
  );

  return localUrl && backendOrigin ? `${backendOrigin}${localUrl[1]}` : imageUrl;
}

function mapStatus(status: MobileBookingRecord['status']): BookingStatus {
  return status === 'Ongoing' ? 'Active' : status;
}

function mapDriverType(value: MobileBookingRecord['driverType']): DriverType {
  return value === "Owner's Driver" ? "Owner's Driver" : 'Self-Drive';
}

function mapPaymentStatus(value: string): PaymentStatus {
  if (value === 'Partially Paid' || value === 'Paid' || value === 'Refunded') {
    return value;
  }

  return 'Unpaid';
}

function mapTransmission(value: string): Booking['transmission'] {
  return value.toLowerCase() === 'manual' ? 'Manual' : 'Automatic';
}

function mapFuelType(value: string): Booking['fuelType'] {
  const fuelType = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

  if (fuelType === 'Diesel' || fuelType === 'Hybrid' || fuelType === 'Electric') {
    return fuelType;
  }

  return 'Gasoline';
}

export function mapBooking(record: MobileBookingRecord): Booking {
  return {
    id: record.bookingCode || record.id,
    backendId: Number(record.backendId),
    vehicleName: record.vehicleName,
    brand: record.brand,
    model: record.model,
    image: normalizeImageUrl(record.image),
    status: mapStatus(record.status),
    rentalDate: record.rentalDate,
    returnDate: record.returnDate,
    duration: Number(record.duration),
    pickupType: record.pickupType,
    pickupLocation: record.pickupLocation,
    deliveryTime: record.deliveryTimeLabel ?? record.deliveryTime,
    returnLocation: record.returnLocation,
    driverType: mapDriverType(record.driverType),
    bookingType: mapDriverType(record.bookingType),
    transmission: mapTransmission(record.transmission),
    fuelType: mapFuelType(record.fuelType),
    seats: Number(record.seats),
    pricePerDay: Number(record.pricePerDay),
    subtotal: Number(record.subtotal),
    deliveryFee: Number(record.deliveryFee),
    outsideManilaFee: Number(record.outsideManilaFee),
    ownerDriverFee: Number(record.ownerDriverFee),
    optionalServices: Number(record.optionalServices),
    addOns: Number(record.addOns),
    discount: Number(record.discount),
    downPayment: Number(record.downPayment),
    totalAmount: Number(record.totalAmount),
    remainingBalance: Number(record.remainingBalance),
    balanceDueAt: record.balanceDueAt,
    paymentStatus: mapPaymentStatus(record.paymentStatus),
    paymentMethod: record.paymentMethod || 'N/A',
    transactionId: record.transactionId || 'N/A',
    paidAt: record.paidAt || 'N/A',
    createdAt: record.createdAt,
    adminNotes: record.adminNotes ?? '',
    calibrationStatus: record.calibrationStatus,
    calibratedAt: record.calibratedAt,
    rentalProgress: record.rentalProgress,
    additionalCharges: record.additionalCharges ?? [],
    customer: record.customer,
    documents: record.documents ?? [],
    timeline: record.timeline ?? [],
  };
}

export async function getBookings() {
  const bookings: Booking[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const response = await apiGet<MobileBookingRecord[]>(
      `/mobile/bookings?per_page=100&page=${page}`,
    );

    bookings.push(...response.data.map(mapBooking));
    lastPage = Number(response.meta?.last_page ?? 1);
    page += 1;
  } while (page <= lastPage);

  return bookings;
}

export async function getBooking(bookingId: string) {
  const response = await apiGet<MobileBookingRecord>(
    `/mobile/bookings/${encodeURIComponent(bookingId)}`,
  );

  return mapBooking(response.data);
}

export async function cancelBooking(bookingId: string, reason = 'Cancelled by customer.') {
  const response = await apiPost<MobileBookingRecord>(
    `/mobile/bookings/${encodeURIComponent(bookingId)}/cancel`,
    { reason },
  );

  return mapBooking(response.data);
}

export async function recordBookingCalibration(bookingId: string) {
  const response = await apiPost<MobileBookingRecord>(
    `/mobile/bookings/${encodeURIComponent(bookingId)}/calibration`,
  );

  return mapBooking(response.data);
}

export async function getDriverServices() {
  const response = await apiGet<MobileBookingRecord[]>('/mobile/driver/services?per_page=100');

  return response.data.map(mapBooking);
}

export async function getDriverService(bookingId: string) {
  const response = await apiGet<MobileBookingRecord>(
    `/mobile/driver/services/${encodeURIComponent(bookingId)}`,
  );

  return mapBooking(response.data);
}
