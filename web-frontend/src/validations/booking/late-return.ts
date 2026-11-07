import { z } from "zod/v3";
import { feePricingSchema } from "@/validations/pricing/schemas";

const money = (min: number, max: number) => z.string().trim().min(1, "Amount is required.")
  .regex(/^\d+(?:\.\d{1,2})?$/, "Use no more than two decimal places.")
  .refine((value) => Number(value) >= min && Number(value) <= max, `Enter an amount between ${min} and ${max}.`);
export const lateReturnPricingSchema = feePricingSchema.pick({
  small_vehicle_hourly_rate: true,
  large_vehicle_hourly_rate: true,
});
export type LateReturnPricingValues = z.infer<typeof lateReturnPricingSchema>;

const dateTime = z.string().min(1, "Time is required.").refine((value) => Number.isFinite(Date.parse(`${value}+08:00`)), "Enter a valid time.");
export const receiveVehicleSchema = z.object({
  vehicle_received_at: dateTime.refine((value) => Date.parse(`${value}+08:00`) <= Date.now(), "Received time cannot be in the future."),
});
export type ReceiveVehicleValues = z.infer<typeof receiveVehicleSchema>;
export const lateChargeSchema = z.object({
  amount: money(0, 9_999_999.99),
  adjustment_reason: z.string().trim().max(1000),
  responsibility: z.enum(["customer", "driver"]),
});
export type LateChargeValues = z.infer<typeof lateChargeSchema>;
export const returnFollowUpSchema = z.object({
  note: z.string().trim().min(1, "Contact outcome is required.").max(1000),
  expected_return_at: z.union([z.literal(""), dateTime.refine((value) => Date.parse(`${value}+08:00`) > Date.now(), "Expected return must be in the future.")]),
});
export type ReturnFollowUpValues = z.infer<typeof returnFollowUpSchema>;

export const createLateChargeSchema = (expectedAmount: number | null, selfDrive: boolean, billableHours: number) => lateChargeSchema.superRefine((values, ctx) => {
  if ((expectedAmount === null || Math.abs(Number(values.amount) - expectedAmount) >= 0.005) && !values.adjustment_reason) ctx.addIssue({ code: "custom", path: ["adjustment_reason"], message: "Explain the waiver, adjustment, or legacy agreement." });
  if (selfDrive && values.responsibility !== "customer") ctx.addIssue({ code: "custom", path: ["responsibility"], message: "Self Drive charges are the Customer responsibility." });
  if (billableHours === 0 && Number(values.amount) > 0) ctx.addIssue({ code: "custom", path: ["amount"], message: "A vehicle received on time cannot incur a late charge." });
});

export const resolveMissedStartSchema = z.object({ reason: z.string().trim().min(1, "Explain the missed-start resolution.").max(1000), resolution: z.enum(["no_show", "cancel"]) });
export type ResolveMissedStartValues = z.infer<typeof resolveMissedStartSchema>;
