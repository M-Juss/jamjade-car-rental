import { z } from "zod/v3";

const requiredText = z.string().trim().min(1, "This field is required.");
const positiveIntegerText = z.string().trim().refine(
  (value) => Number.isInteger(Number(value)) && Number(value) >= 1,
  "Enter a positive whole number.",
);
const nonNegativeIntegerText = z.string().trim().refine(
  (value) => Number.isInteger(Number(value)) && Number(value) >= 0,
  "Enter a valid whole number.",
);
const optionalPositiveIntegerText = z.string().trim().optional().refine(
  (value) => !value || (Number.isInteger(Number(value)) && Number(value) >= 1),
  "Enter a positive whole number.",
);
const optionalNonNegativeIntegerText = z.string().trim().optional().refine(
  (value) => !value || (Number.isInteger(Number(value)) && Number(value) >= 0),
  "Enter a valid whole number.",
);
const optionalNonNegativeAmount = z.string().trim().optional().refine(
  (value) => !value || (
    Number.isFinite(Number(value)) &&
    Number(value) >= 0 &&
    Number(value) <= 9_999_999_999.99
  ),
  "Enter an amount from 0 to 9,999,999,999.99.",
);
const optionalId = z.string().trim().optional().refine(
  (value) => !value || (Number.isInteger(Number(value)) && Number(value) >= 1),
  "Select a valid option.",
);

function validDate(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

export const maintenancePlanSchema = z.object({
  vehicleId: positiveIntegerText,
  name: requiredText.max(150),
  category: z.enum(["preventive", "corrective", "body_repair", "other"]),
  description: z.string().trim().max(2000).optional(),
  triggerType: z.enum(["mileage", "date", "both"]),
  intervalKm: optionalPositiveIntegerText,
  intervalDays: optionalPositiveIntegerText,
  nextDueOdometer: optionalNonNegativeIntegerText,
  nextDueDate: z.string().trim().optional(),
}).superRefine((value, context) => {
  if (value.triggerType !== "date") {
    if (!value.intervalKm) context.addIssue({ code: "custom", path: ["intervalKm"], message: "Enter a positive interval." });
    if (!value.nextDueOdometer) context.addIssue({ code: "custom", path: ["nextDueOdometer"], message: "Enter the next due odometer." });
  }
  if (value.triggerType !== "mileage") {
    if (!value.intervalDays) context.addIssue({ code: "custom", path: ["intervalDays"], message: "Enter a positive interval." });
    if (!value.nextDueDate) context.addIssue({ code: "custom", path: ["nextDueDate"], message: "Choose the next due date." });
    else if (!validDate(value.nextDueDate)) context.addIssue({ code: "custom", path: ["nextDueDate"], message: "Choose a valid next due date." });
  }
});

export const scheduleMaintenanceSchema = z.object({
  vehicleId: positiveIntegerText,
  planId: optionalId,
  title: z.string().trim().max(150).optional(),
  category: z.enum(["preventive", "corrective", "body_repair", "other"]),
  scheduledStart: requiredText,
  scheduledEnd: requiredText,
  serviceProvider: z.string().trim().max(150).optional(),
  technician: z.string().trim().max(150).optional(),
  description: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(3000).optional(),
}).superRefine((value, context) => {
  if (!value.planId && !value.title?.trim()) context.addIssue({ code: "custom", path: ["title"], message: "Enter a maintenance title or choose a plan." });

  const startIsValid = validDate(value.scheduledStart);
  const endIsValid = validDate(value.scheduledEnd);

  if (!startIsValid) {
    context.addIssue({ code: "custom", path: ["scheduledStart"], message: "Choose a valid start date and time." });
  } else if (new Date(value.scheduledStart).getTime() < Date.now()) {
    context.addIssue({ code: "custom", path: ["scheduledStart"], message: "Start date and time cannot be in the past." });
  }

  if (!endIsValid) {
    context.addIssue({ code: "custom", path: ["scheduledEnd"], message: "Choose a valid expected end." });
  } else if (startIsValid && new Date(value.scheduledEnd) <= new Date(value.scheduledStart)) {
    context.addIssue({ code: "custom", path: ["scheduledEnd"], message: "Expected end must be after the start." });
  }
});

export const completeMaintenanceSchema = z.object({
  odometerAtCompletion: nonNegativeIntegerText,
  workPerformed: requiredText.max(5000),
  serviceProvider: z.string().trim().max(150).optional(),
  technician: z.string().trim().max(150).optional(),
  laborCost: optionalNonNegativeAmount,
  partsCost: optionalNonNegativeAmount,
  otherCost: optionalNonNegativeAmount,
  notes: z.string().trim().max(3000).optional(),
});

export type MaintenancePlanFormValues = z.infer<typeof maintenancePlanSchema>;
export type ScheduleMaintenanceFormValues = z.infer<typeof scheduleMaintenanceSchema>;
export type CompleteMaintenanceFormValues = z.infer<typeof completeMaintenanceSchema>;
