import { z } from "zod/v3";
import { vehicleConditionSchema } from "@/validations/vehicle/schemas";

export const assignDriverSchema = z.object({
  driver_id: z.string().trim().min(1, "Select a driver.").regex(/^\d+$/, "Select a valid driver."),
});

export type AssignDriverFormValues = z.infer<typeof assignDriverSchema>;

const signatureSchema = z.string().trim().min(1, "Signature is required.")
  .max(1_400_000, "Signature is too large.")
  .regex(/^data:image\/png;base64,/, "Please provide a valid signature.");

export const bookingInspectionSchema = z.object({
  condition: vehicleConditionSchema,
  operator_signature_data: signatureSchema,
});

export type BookingInspectionFormValues = z.infer<typeof bookingInspectionSchema>;

export const additionalChargesSchema = z.object({
  charges: z.array(z.object({
    type: z.enum(["late_return", "toll_fee", "vehicle_damage", "cleaning", "fuel", "traffic_violation", "other"]),
    description: z.string().trim().min(1, "Description is required.").max(1000),
    amount: z.string().trim().min(1, "Amount is required.").regex(/^\d+(?:\.\d{1,2})?$/, "Use no more than two decimal places.").refine((value) => {
      const amount = Number(value);
      return Number.isFinite(amount) && amount > 0 && amount <= 9_999_999.99;
    }, "Enter a valid amount."),
    responsibility: z.enum(["customer", "driver"]).optional(),
  })).min(1).max(20),
});

export type AdditionalChargesFormValues = z.infer<typeof additionalChargesSchema>;
