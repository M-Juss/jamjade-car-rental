import { z } from "zod/v3";
import type { VehicleRecord } from "@/services/vehicle";
import { maintenanceDateKey } from "@/services/maintenance/dates";

const requiredText = z.string().trim().min(1, "This field is required.");
const positiveIntegerText = z.string().trim().regex(/^\d+$/, "Enter digits only.").refine(
  (value) => Number.isInteger(Number(value)) && Number(value) >= 1,
  "Enter a positive whole number.",
);
const optionalPositiveIntegerText = z.string().trim().optional().refine(
  (value) => !value || (/^\d+$/.test(value) && Number.isInteger(Number(value)) && Number(value) >= 1),
  "Enter a positive whole number.",
);
const optionalNonNegativeIntegerText = z.string().trim().optional().refine(
  (value) => !value || (/^\d+$/.test(value) && Number.isInteger(Number(value)) && Number(value) >= 0),
  "Enter a valid whole number.",
);
const optionalNonNegativeAmount = z.string().trim().optional().refine(
  (value) => !value || (
    Number.isFinite(Number(value))
    && /^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(value)
    && Number(value) >= 0
    && Number(value) <= 9_999_999_999.99
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

function validDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && validDate(value);
}

function localDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function crossesBlockedDate(
  start: string,
  end: string,
  ranges: NonNullable<VehicleRecord["unavailableDateRanges"]>,
) {
  const cursor = new Date(`${localDateKey(start)}T12:00:00`);
  const last = new Date(`${localDateKey(end)}T12:00:00`);
  while (cursor <= last) {
    const key = localDateKey(cursor);
    if (ranges.some((range) => (
      key >= range.startDate
      && (range.openEnded || !range.endDate || key <= range.endDate)
    ))) return true;
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

export const maintenancePlanSchema = z.object({
  vehicleId: positiveIntegerText,
  name: requiredText.max(150),
  category: z.enum(["preventive", "corrective", "body_repair", "other"]),
  description: z.string().trim().max(2000).optional(),
  triggerType: z.enum(["mileage", "date", "both"]),
  intervalKm: optionalPositiveIntegerText,
  intervalDays: optionalPositiveIntegerText,
}).superRefine((value, context) => {
  if (value.triggerType !== "date" && !value.intervalKm) {
    context.addIssue({ code: "custom", path: ["intervalKm"], message: "Enter a positive interval." });
  }
  if (value.triggerType !== "mileage" && !value.intervalDays) {
    context.addIssue({ code: "custom", path: ["intervalDays"], message: "Enter a positive interval." });
  }
});

const scheduleFields = z.object({
  vehicleId: positiveIntegerText,
  planId: optionalId,
  title: z.string().trim().max(150).optional(),
  category: z.enum(["preventive", "corrective", "body_repair", "other"]),
  scheduledStart: requiredText,
  scheduledEnd: requiredText,
  serviceProvider: requiredText.max(150),
  description: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(3000).optional(),
});

export function createScheduleMaintenanceSchema(
  ranges: NonNullable<VehicleRecord["unavailableDateRanges"]> = [],
) {
  return scheduleFields.superRefine((value, context) => {
    if (!value.planId && !value.title?.trim()) {
      context.addIssue({ code: "custom", path: ["title"], message: "Enter a maintenance title." });
    }
    const startIsValid = validDateOnly(value.scheduledStart);
    const endIsValid = validDateOnly(value.scheduledEnd);
    if (!startIsValid) {
      context.addIssue({ code: "custom", path: ["scheduledStart"], message: "Choose a valid start date." });
    } else if (value.scheduledStart < maintenanceDateKey()) {
      context.addIssue({ code: "custom", path: ["scheduledStart"], message: "Start date cannot be before today." });
    }
    if (!endIsValid) {
      context.addIssue({ code: "custom", path: ["scheduledEnd"], message: "Choose a valid expected end date." });
    } else if (startIsValid && value.scheduledEnd < value.scheduledStart) {
      context.addIssue({ code: "custom", path: ["scheduledEnd"], message: "Expected end date cannot be before the start date." });
    } else if (startIsValid && crossesBlockedDate(value.scheduledStart, value.scheduledEnd, ranges)) {
      context.addIssue({ code: "custom", path: ["scheduledEnd"], message: "The selected range includes an unavailable date." });
    }
  });
}

export function createRescheduleMaintenanceSchema(
  ranges: NonNullable<VehicleRecord["unavailableDateRanges"]> = [],
) {
  return z.object({
    scheduledStart: requiredText,
    scheduledEnd: requiredText,
  }).superRefine((value, context) => {
    const startValid = validDateOnly(value.scheduledStart);
    const endValid = validDateOnly(value.scheduledEnd);
    if (!startValid || value.scheduledStart < maintenanceDateKey()) {
      context.addIssue({ code: "custom", path: ["scheduledStart"], message: "Choose today or a future start date." });
    }
    if (!endValid || (startValid && value.scheduledEnd < value.scheduledStart)) {
      context.addIssue({ code: "custom", path: ["scheduledEnd"], message: "Expected end date cannot be before the start date." });
    } else if (startValid && crossesBlockedDate(value.scheduledStart, value.scheduledEnd, ranges)) {
      context.addIssue({ code: "custom", path: ["scheduledEnd"], message: "The selected range includes an unavailable date." });
    }
  });
}

const completeMaintenanceFields = z.object({
  odometerAtCompletion: optionalNonNegativeIntegerText,
  serviceProvider: z.string().trim().max(150).optional(),
  laborCost: optionalNonNegativeAmount.refine((value) => !!value, "Enter an amount, or 0."),
  partsCost: optionalNonNegativeAmount.refine((value) => !!value, "Enter an amount, or 0."),
  otherCost: optionalNonNegativeAmount.refine((value) => !!value, "Enter an amount, or 0."),
  notes: z.string().trim().max(3000).optional(),
  conditionChanged: z.enum(["yes", "no"]).optional(),
});

export function createCompleteMaintenanceSchema(options: {
  requireOdometer: boolean;
  requireConditionDecision: boolean;
  forceConditionVerification: boolean;
}) {
  return completeMaintenanceFields.superRefine((value, context) => {
    if (options.requireOdometer && !value.odometerAtCompletion) {
      context.addIssue({ code: "custom", path: ["odometerAtCompletion"], message: "Enter the completion odometer." });
    }
    if (options.requireConditionDecision && !value.conditionChanged) {
      context.addIssue({ code: "custom", path: ["conditionChanged"], message: "Confirm whether tracked vehicle condition changed." });
    }
    if (options.forceConditionVerification && value.conditionChanged !== "yes") {
      context.addIssue({ code: "custom", path: ["conditionChanged"], message: "Body Repair requires vehicle condition verification." });
    }
  });
}

export const cancelMaintenanceSchema = z.object({
  reason: z.string().trim().max(3000).optional(),
});

export type MaintenancePlanFormValues = z.infer<typeof maintenancePlanSchema>;
export type ScheduleMaintenanceFormValues = z.infer<typeof scheduleFields>;
export type RescheduleMaintenanceFormValues = { scheduledStart: string; scheduledEnd: string };
export type CompleteMaintenanceFormValues = z.infer<typeof completeMaintenanceFields>;
export type CancelMaintenanceFormValues = z.infer<typeof cancelMaintenanceSchema>;
