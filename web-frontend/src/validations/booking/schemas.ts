import { z } from "zod/v3";
import { vehicleConditionSchema } from "@/validations/vehicle/schemas";

export const assignDriverSchema = z.object({
  driver_id: z.string().trim().min(1, "Select a driver.").regex(/^\d+$/, "Select a valid driver."),
});

export type AssignDriverFormValues = z.infer<typeof assignDriverSchema>;

export const assignBookingGeofenceSchema = z.object({
  source_geofence_id: z.string(),
  name: z.string().trim().max(255),
  geometry_type: z.enum(["circle", "polygon"]).optional(),
  center_latitude: z.string(),
  center_longitude: z.string(),
  radius_meters: z.string(),
}).superRefine((value, context) => {
  if (value.source_geofence_id !== "custom") {
    if (!/^\d+$/.test(value.source_geofence_id) || Number(value.source_geofence_id) <= 0) {
      context.addIssue({ code: "custom", path: ["source_geofence_id"], message: "Select a valid boundary." });
    }
    return;
  }
  if (!value.name) context.addIssue({ code: "custom", path: ["name"], message: "Enter a boundary name." });
  if (!value.center_latitude.trim() || !Number.isFinite(Number(value.center_latitude)) || Number(value.center_latitude) < -90 || Number(value.center_latitude) > 90) {
    context.addIssue({ code: "custom", path: ["center_latitude"], message: "Enter a latitude between -90 and 90." });
  }
  if (!value.center_longitude.trim() || !Number.isFinite(Number(value.center_longitude)) || Number(value.center_longitude) < -180 || Number(value.center_longitude) > 180) {
    context.addIssue({ code: "custom", path: ["center_longitude"], message: "Enter a longitude between -180 and 180." });
  }
  if (!Number.isFinite(Number(value.radius_meters)) || Number(value.radius_meters) <= 0 || Number(value.radius_meters) > 100000) {
    context.addIssue({ code: "custom", path: ["radius_meters"], message: "Enter a radius from 1 to 100,000 meters." });
  }
});

export type AssignBookingGeofenceFormValues = z.infer<typeof assignBookingGeofenceSchema>;

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
