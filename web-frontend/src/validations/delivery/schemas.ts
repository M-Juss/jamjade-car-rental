import { z } from "zod/v3";
import { feePricingSchema } from "@/validations/pricing/schemas";

export const deliveryPricingSchema = feePricingSchema.pick({
  minimum_fee: true,
  included_km: true,
  per_km_rate: true,
});
export type DeliveryPricingValues = z.infer<typeof deliveryPricingSchema>;
