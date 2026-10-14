import { apiGet, apiPost, apiPut } from "@/services/http";
import type {
  DeliveryPricingValues,
  DeliveryReviewValues,
} from "@/validations/delivery/schemas";
export type DeliveryPricingSettings = {
  minimum_fee: number;
  included_km: number;
  per_km_rate: number;
  garage_address: string;
  garage_latitude: number | null;
  garage_longitude: number | null;
};
export type DeliveryQuote = {
  customerName?: string;
  vehicleName?: string;
  id: string;
  vehicleId: string;
  destinationAddress: string;
  destinationPoint: { latitude: number; longitude: number } | null;
  rentalStartAt: string;
  rentalEndAt: string;
  routeLabel: string;
  tollStatus: "toll" | "unknown" | "toll_free";
  deliveryFee: number;
  reviewDeadline: string;
  status: string;
};
export async function getDeliveryPricing() {
  return (await apiGet<DeliveryPricingSettings>("/admin/delivery-pricing"))
    .data;
}
export async function saveDeliveryPricing(values: DeliveryPricingValues) {
  return (
    await apiPut<DeliveryPricingSettings>("/admin/delivery-pricing", {
      minimum_fee: Number(values.minimum_fee),
      included_km: Number(values.included_km),
      per_km_rate: Number(values.per_km_rate),
      garage_address: values.garage_address,
      garage_latitude: Number(values.garage_latitude),
      garage_longitude: Number(values.garage_longitude),
    })
  ).data;
}
export function getDeliveryRequests(page: number) {
  return apiGet<DeliveryQuote[]>(`/admin/delivery-quotes?page=${page}`);
}
export async function reviewDeliveryQuote(
  id: string,
  values: DeliveryReviewValues,
) {
  return (
    await apiPost(`/admin/delivery-quotes/${encodeURIComponent(id)}/review`, {
      decision: values.decision,
      delivery_toll_fee:
        values.decision === "approve" ? Number(values.delivery_toll_fee) : null,
      review_note: values.review_note || null,
    })
  ).data;
}

export type SelectedDeliveryRoute = {
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string | null;
};
export async function getSelectedDeliveryRoute(id: string) {
  return (
    await apiGet<SelectedDeliveryRoute>(
      `/admin/delivery-quotes/${encodeURIComponent(id)}/route`,
    )
  ).data;
}
