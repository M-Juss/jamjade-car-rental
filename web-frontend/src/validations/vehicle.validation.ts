import { z } from "zod/v3";

const REQUIRED_MESSAGE = "This field is required.";
const IMAGE_SIZE_LIMIT = 5 * 1024 * 1024;
const IMAGE_TOTAL_SIZE_LIMIT = 10 * 1024 * 1024;

const requiredText = z.string().trim().min(1, REQUIRED_MESSAGE);

const positiveNumberText = requiredText.refine((value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0;
}, "Enter a valid number.");

const positiveIntegerText = requiredText.refine((value) => {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0;
}, "Enter a valid number.");

const vehicleImageSchema = z
  .custom<File>(
    (value) => typeof File !== "undefined" && value instanceof File,
    "Please upload a valid image.",
  )
  .refine((file) => file.type.startsWith("image/"), "Please upload a valid image.")
  .refine((file) => file.size <= IMAGE_SIZE_LIMIT, "Image must be 5MB or smaller.");

export const vehicleStatusSchema = z.enum(["available", "unavailable", "maintenance"]);

export const vehicleFormSchema = z.object({
  name: requiredText.max(160, "Maximum 160 characters only."),
  brand: requiredText.max(80, "Maximum 80 characters only."),
  model: requiredText.max(120, "Maximum 120 characters only."),
  description: requiredText.max(3000, "Maximum 3000 characters only."),
  price_per_day: positiveNumberText,
  seats: positiveIntegerText.refine(
    (value) => Number(value) <= 20,
    "Seats cannot exceed 20.",
  ),
  color: requiredText.max(80, "Maximum 80 characters only."),
  transmission: requiredText.max(40, "Maximum 40 characters only."),
  fuel_type: requiredText.max(40, "Maximum 40 characters only."),
  status: vehicleStatusSchema,
  features: z.array(requiredText.max(120)).min(1, "Select at least one feature."),
  images: z.array(vehicleImageSchema).min(1, "Upload at least one image."),
}).superRefine((values, context) => {
  const totalImageSize = values.images.reduce((total, file) => total + file.size, 0);

  if (totalImageSize > IMAGE_TOTAL_SIZE_LIMIT) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Vehicle images are too large. Remove one image or choose smaller photos.",
      path: ["images"],
    });
  }
});

export type VehicleFormValues = z.infer<typeof vehicleFormSchema>;
