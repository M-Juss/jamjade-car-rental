import { apiPut } from "@/services/http";
import type { FeePricingValues } from "@/validations/pricing/schemas";

export async function saveFeePricing(values: FeePricingValues) {
  return (await apiPut("/admin/fee-pricing", {
    small_vehicle_hourly_rate: Number(values.small_vehicle_hourly_rate),
    large_vehicle_hourly_rate: Number(values.large_vehicle_hourly_rate),
    minimum_fee: Number(values.minimum_fee),
    included_km: Number(values.included_km),
    per_km_rate: Number(values.per_km_rate),
  })).data;
}
