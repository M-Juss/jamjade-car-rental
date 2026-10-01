import { z } from "zod/v3";
import { VEHICLE_CHECKLIST } from "@/modules/management/vehicles/inspection/definitions";
import { VEHICLE_ISSUE_TYPES, VEHICLE_PANEL_ORDER } from "@/modules/management/vehicles/inspection/types";

const REQUIRED_MESSAGE = "This field is required.";
const IMAGE_SIZE_LIMIT = 5 * 1024 * 1024;

const requiredText = z.string().trim().min(1, REQUIRED_MESSAGE);

const positiveNumberText = requiredText.refine((value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0;
}, "Enter a valid number.");

const positiveIntegerText = requiredText.refine((value) => {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0;
}, "Enter a valid number.");

const nonNegativeIntegerText = requiredText.refine((value) => {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue >= 0;
}, "Enter a valid odometer reading.");

const vehicleImageSchema = z
  .custom<File>(
    (value) => typeof File !== "undefined" && value instanceof File,
    "Please upload a valid image.",
  )
  .refine((file) => file.type.startsWith("image/"), "Please upload a valid image.")
  .refine((file) => file.size <= IMAGE_SIZE_LIMIT, "Image must be 5MB or smaller.");

export const vehicleStatusSchema = z.enum(["available", "unavailable", "maintenance"]);

const vehicleDetailsSchema = z.object({
  name: requiredText.max(160, "Maximum 160 characters only."),
  brand: requiredText.max(80, "Maximum 80 characters only."),
  model: requiredText.max(120, "Maximum 120 characters only."),
  plate_number: requiredText.max(32, "Maximum 32 characters only."),
  description: requiredText.max(3000, "Maximum 3000 characters only."),
  price_per_day: positiveNumberText,
  seats: positiveIntegerText.refine(
    (value) => Number(value) <= 20,
    "Seats cannot exceed 20.",
  ),
  color: requiredText.max(80, "Maximum 80 characters only."),
  transmission: requiredText.max(40, "Maximum 40 characters only."),
  fuel_type: requiredText.max(40, "Maximum 40 characters only."),
  features: z.array(requiredText.max(120))
    .min(1, "Select at least one feature.")
    .refine(
      (features) => features.every((feature) => feature.toLowerCase() !== "dashcam"),
      "Dashcam is no longer offered.",
    ),
});

const checklistValue = z.boolean();

function checklistCategorySchema(items: Record<string, string>) {
  return z.object(
    Object.fromEntries(
      Object.keys(items).map((key) => [key, checklistValue]),
    ) as Record<string, typeof checklistValue>,
  );
}

export const vehicleBodyMarkerSchema = z.object({
  id: z.string().optional(),
  sequenceNumber: z.number().int().min(1),
  panel: z.enum(VEHICLE_PANEL_ORDER),
  xPosition: z.number().min(0).max(100),
  yPosition: z.number().min(0).max(100),
  issueType: z.enum(VEHICLE_ISSUE_TYPES),
  description: requiredText.max(1000, "Maximum 1000 characters only."),
});

export const vehicleConditionSchema = z.object({
  odometer: nonNegativeIntegerText,
  fuel_level: z
    .number()
    .int()
    .min(0)
    .max(8)
    .nullable()
    .refine((value): boolean => value !== null, "Select the fuel level."),
  comments: z.string().trim().max(3000, "Maximum 3000 characters only."),
  checklist: z.object({
    exterior: checklistCategorySchema(VEHICLE_CHECKLIST.exterior),
    interior: checklistCategorySchema(VEHICLE_CHECKLIST.interior),
    equipment: checklistCategorySchema(VEHICLE_CHECKLIST.equipment),
  }),
  markers: z.array(vehicleBodyMarkerSchema),
  signature_data: requiredText
    .max(1_400_000, "Signature is too large.")
    .regex(/^data:image\/png;base64,/, "Please provide a valid signature."),
});

export const VEHICLE_CONDITION_UPDATE_REASONS = [
  { value: "correction_reinspection", label: "Correction / Reinspection" },
  { value: "maintenance_completed", label: "Maintenance Completed" },
  { value: "repair_completed", label: "Repair Completed" },
  { value: "refueling_servicing", label: "Refueling / Servicing" },
  { value: "issue_discovered", label: "Issue Discovered" },
  { value: "company_use", label: "Company Use" },
  { value: "other", label: "Other" },
] as const;

const vehicleConditionUpdateReasonValues = VEHICLE_CONDITION_UPDATE_REASONS.map(
  ({ value }) => value,
);

export function createVehicleConditionUpdateSchema(currentOdometer: number) {
  return z.object({
    reason: requiredText.refine(
      (value) => vehicleConditionUpdateReasonValues.includes(
        value as (typeof vehicleConditionUpdateReasonValues)[number],
      ),
      "Select a valid update reason.",
    ),
    notes: z.string().trim().max(3000, "Maximum 3000 characters only."),
    condition: vehicleConditionSchema,
  }).superRefine((values, context) => {
    if (values.reason === "other" && !values.notes) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Notes are required when the reason is Other.",
        path: ["notes"],
      });
    }

    if (Number(values.condition.odometer) >= currentOdometer) return;

    if (values.reason !== "correction_reinspection") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use Correction / Reinspection to enter a lower odometer reading.",
        path: ["condition", "odometer"],
      });
    } else if (!values.notes) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Explain why the corrected odometer is lower than the current reading.",
        path: ["notes"],
      });
    }
  });
}

export const editVehicleFormSchema = vehicleDetailsSchema;

export const vehicleInformationSchema = vehicleDetailsSchema.extend({
  status: vehicleStatusSchema,
  images: z
    .array(vehicleImageSchema)
    .min(1, "Upload at least one image.")
    .max(5, "Upload no more than five images."),
});

export const vehicleFormSchema = vehicleInformationSchema.extend({
  initial_condition: vehicleConditionSchema,
});

export type VehicleFormValues = z.infer<typeof vehicleFormSchema>;
export type EditVehicleFormValues = z.infer<typeof editVehicleFormSchema>;
export type VehicleConditionFormValues = z.infer<typeof vehicleConditionSchema>;
export type VehicleConditionUpdateFormValues = z.infer<
  ReturnType<typeof createVehicleConditionUpdateSchema>
>;

export function createVehicleConditionDefaults(): VehicleConditionFormValues {
  return {
    odometer: "",
    fuel_level: null,
    comments: "",
    checklist: Object.fromEntries(
      Object.entries(VEHICLE_CHECKLIST).map(([category, items]) => [
        category,
        Object.fromEntries(Object.keys(items).map((key) => [key, false])),
      ]),
    ) as VehicleConditionFormValues["checklist"],
    markers: [],
    signature_data: "",
  };
}
