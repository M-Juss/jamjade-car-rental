import { apiGet, apiPut } from "@/services/http";
import type {
  DeliveryPricingValues,
} from "@/validations/delivery/schemas";
export type DeliveryPricingSettings = {
  minimum_fee: number;
  included_km: number;
  per_km_rate: number;
  garage_address: string;
  garage_latitude: number | null;
  garage_longitude: number | null;
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
    })
  ).data;
}
