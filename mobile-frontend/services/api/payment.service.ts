import { apiPost } from '@/services/http';

import type {
  MobileBookingRecord,
  PayPalOrderPayload,
  PayPalOrderResponse,
} from './types';

export async function createPayPalOrder(payload: PayPalOrderPayload) {
  const response = await apiPost<PayPalOrderResponse>('/mobile/paypal/orders', {
    vehicle_id: payload.vehicleId,
    rental_start_at: payload.rentalStartAt,
    rental_end_at: payload.rentalEndAt,
    pickup_location_type: payload.pickupLocationType,
    pickup_location: payload.pickupLocation,
    return_location: payload.returnLocation,
    driver_option: payload.driverOption,
    owner_driver_coverage: payload.ownerDriverCoverage,
    payment_option: payload.paymentOption,
    customer_signature: payload.customerSignature,
    terms_version: payload.termsVersion,
    app_return_url: payload.appReturnUrl,
    app_cancel_url: payload.appCancelUrl,
  });

  return response.data;
}

export async function capturePayPalOrder(orderId: string) {
  const response = await apiPost<MobileBookingRecord>(
    `/mobile/paypal/orders/${encodeURIComponent(orderId)}/capture`,
  );

  return response.data;
}

export async function createRemainingBalancePayPalOrder(
  bookingId: string,
  appReturnUrl: string,
  appCancelUrl: string,
) {
  const response = await apiPost<PayPalOrderResponse>(
    `/mobile/bookings/${encodeURIComponent(bookingId)}/paypal/orders`,
    {
      app_return_url: appReturnUrl,
      app_cancel_url: appCancelUrl,
    },
  );

  return response.data;
}

export async function createDriverOutstandingPayPalOrder(
  bookingId: string,
  appReturnUrl: string,
  appCancelUrl: string,
) {
  const response = await apiPost<PayPalOrderResponse>(
    `/mobile/driver/services/${encodeURIComponent(bookingId)}/paypal/orders`,
    {
      app_return_url: appReturnUrl,
      app_cancel_url: appCancelUrl,
    },
  );

  return response.data;
}

export async function abandonPayPalOrder(orderId: string) {
  await apiPost(`/mobile/paypal/orders/${encodeURIComponent(orderId)}/abandon`);
}
