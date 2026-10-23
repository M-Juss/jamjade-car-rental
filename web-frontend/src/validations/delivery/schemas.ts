import { z } from "zod/v3";
const numeric = (min: number, max: number, decimals?: number) =>
  z
    .string()
    .min(1, "This field is required.")
    .refine(
      (value) =>
        value.trim() !== "" &&
        Number.isFinite(Number(value)) &&
        Number(value) >= min &&
        Number(value) <= max &&
        (decimals === undefined ||
          Math.abs(
            Number(value) * 10 ** decimals -
              Math.round(Number(value) * 10 ** decimals),
          ) < 0.000001),
      `Enter a number from ${min} to ${max}.`,
    );
export const deliveryPricingSchema = z.object({
  minimum_fee: numeric(0, 1000000, 2),
  included_km: numeric(0, 1000000, 3),
  per_km_rate: numeric(0, 1000000, 2),
});
export type DeliveryPricingValues = z.infer<typeof deliveryPricingSchema>;
