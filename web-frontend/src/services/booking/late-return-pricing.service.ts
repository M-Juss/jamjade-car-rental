import { apiGet, apiPut } from "@/services/http";
import type { LateReturnPricingValues } from "@/validations/booking/late-return";

type LateReturnPricing = { small_vehicle_hourly_rate: number; large_vehicle_hourly_rate: number };
export async function getLateReturnPricing() {
  return (await apiGet<LateReturnPricing>("/admin/late-return-pricing")).data;
}
export async function saveLateReturnPricing(values: LateReturnPricingValues) {
  return (await apiPut<LateReturnPricing>("/admin/late-return-pricing", {
    small_vehicle_hourly_rate: Number(values.small_vehicle_hourly_rate),
    large_vehicle_hourly_rate: Number(values.large_vehicle_hourly_rate),
  })).data;
}
