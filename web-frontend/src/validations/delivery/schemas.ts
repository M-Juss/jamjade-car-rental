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
  garage_address: z
    .string()
    .trim()
    .min(1, "Garage address is required.")
    .max(255),
  garage_latitude: numeric(-90, 90),
  garage_longitude: numeric(-180, 180),
});
export type DeliveryPricingValues = z.infer<typeof deliveryPricingSchema>;
export const deliveryReviewSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    delivery_toll_fee: z.string(),
    review_note: z.string().max(1000),
  })
  .superRefine((value, ctx) => {
    if (
      value.decision === "approve" &&
      !numeric(0, 1000000, 2).safeParse(value.delivery_toll_fee).success
    )
      ctx.addIssue({
        code: "custom",
        path: ["delivery_toll_fee"],
        message:
          "Enter the verified toll amount, including 0 for a toll-free route.",
      });
    if (value.decision === "reject" && !value.review_note.trim())
      ctx.addIssue({
        code: "custom",
        path: ["review_note"],
        message: "Give a reason for rejecting this delivery.",
      });
  });
export type DeliveryReviewValues = z.infer<typeof deliveryReviewSchema>;
