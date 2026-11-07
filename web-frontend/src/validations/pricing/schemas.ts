import { z } from "zod/v3";

const decimal = (minimum: number, places: number) => z.string().trim()
  .min(1, "This field is required.")
  .regex(/^(?:\d+(?:\.\d*)?|\.\d+)$/, "Enter a number using digits and a decimal point.")
  .refine(value => (value.split(".")[1]?.length ?? 0) <= places, `Use no more than ${places} decimal places.`)
  .refine(value => Number.isFinite(Number(value)) && Number(value) >= minimum && Number(value) <= 1_000_000,
    `Enter a number from ${minimum} to 1000000.`);

export const feePricingSchema = z.object({
  small_vehicle_hourly_rate: decimal(0.01, 2),
  large_vehicle_hourly_rate: decimal(0.01, 2),
  minimum_fee: decimal(0, 2),
  included_km: decimal(0, 3),
  per_km_rate: decimal(0, 2),
});

export type FeePricingValues = z.infer<typeof feePricingSchema>;
