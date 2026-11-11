import { apiPost } from '@/services/http';
import { toBookingTimestamp } from '@/lib/browse/booking-time';

import type {
  MobileBookingRecord,
  PayPalOrderPayload,
  PayPalOrderResponse,
} from './types';

export async function createPayPalOrder(payload: PayPalOrderPayload, bookingReference?: string) {
  const path = bookingReference ? `/mobile/bookings/${encodeURIComponent(bookingReference)}/paypal/revise-order` : '/mobile/paypal/orders';
  const response = await apiPost<PayPalOrderResponse>(path, {
    delivery_quote_id: payload.deliveryQuoteId,
    vehicle_id: payload.vehicleId,
    rental_start_at: toBookingTimestamp(payload.rentalStartAt),
    rental_end_at: toBookingTimestamp(payload.rentalEndAt),
    pickup_location_type: payload.pickupLocationType,
    pickup_location: payload.pickupLocation,
    notes: payload.notes,
    return_location: payload.returnLocation,
    driver_option: payload.driverOption,
    owner_driver_coverage: payload.ownerDriverCoverage,
    payment_option: payload.paymentOption,
    reviewed_pricing: {
      price_per_day: payload.reviewedPricing.pricePerDay,
      subtotal: payload.reviewedPricing.subtotal,
      delivery_fee: payload.reviewedPricing.deliveryFee,
      delivery_toll_fee: payload.reviewedPricing.deliveryTollFee,
      owner_driver_fee: payload.reviewedPricing.ownerDriverFee,
      total_amount: payload.reviewedPricing.totalAmount,
    },
    customer_signature: payload.customerSignature,
    terms_version: payload.termsVersion,
    late_return_policy_version: payload.lateReturnPolicyVersion,
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
