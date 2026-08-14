"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock } from "lucide-react";
import {
  FormDialogContent,
  FormDialogFooter,
  FormDialogHeader,
} from "@/components/common/FormDialogLayout";
import { useCallback, useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { InputWithLabel } from "@/components/common/InputWithLabel";
import { SelectWithLabel } from "@/components/common/SelectWithLabel";
import { TextAreaWithLabel } from "@/components/common/TextAreaWithLabel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
} from "@/components/ui/dialog";
import { appToast } from "@/lib/toast";
import {
  scheduleMaintenance,
  type MaintenancePlan,
} from "@/services/maintenance";
import type { VehicleRecord } from "@/services/vehicle";
import {
  scheduleMaintenanceSchema,
  type ScheduleMaintenanceFormValues,
} from "@/validations/maintenance/schemas";
import {
  applyMaintenanceServerErrors,
  maintenanceCategoryOptions,
  scheduleMaintenanceDefaults,
} from "./form-support";

const CUSTOM_PLAN_VALUE = "custom";

const serverFieldMap = {
  vehicle_id: "vehicleId",
  maintenance_plan_id: "planId",
  title: "title",
  category: "category",
  scheduled_start: "scheduledStart",
  scheduled_end: "scheduledEnd",
  service_provider: "serviceProvider",
  technician: "technician",
  description: "description",
  notes: "notes",
} as const;

type ScheduleMaintenanceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: VehicleRecord[];
  plans: MaintenancePlan[];
  fixedVehicleId?: string;
  initialPlanId?: string;
  onSaved: () => void;
};

export function ScheduleMaintenanceDialog({
  open,
  onOpenChange,
  vehicles,
  plans,
  fixedVehicleId,
  initialPlanId,
  onSaved,
}: ScheduleMaintenanceDialogProps) {
  const form = useForm<ScheduleMaintenanceFormValues>({
    resolver: zodResolver(scheduleMaintenanceSchema),
    defaultValues: scheduleMaintenanceDefaults,
  });
  const vehicleId = useWatch({ control: form.control, name: "vehicleId" });
  const planId = useWatch({ control: form.control, name: "planId" });
  const defaults = useCallback(() => {
    const initialPlan = initialPlanId
      ? plans.find((plan) => plan.id === initialPlanId)
      : undefined;

    return {
      ...scheduleMaintenanceDefaults,
      vehicleId: fixedVehicleId ?? initialPlan?.vehicleId ?? "",
      planId: initialPlanId ?? "",
    };
  }, [fixedVehicleId, initialPlanId, plans]);

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const availablePlans = useMemo(() => plans.filter(
    (plan) => plan.vehicleId === vehicleId && plan.isActive,
  ), [plans, vehicleId]);

  useEffect(() => {
    if (open) form.reset(defaults());
  }, [defaults, form, open]);

  useEffect(() => {
    if (planId && !availablePlans.some((plan) => plan.id === planId)) {
      form.setValue("planId", "", { shouldValidate: true });
    }
  }, [availablePlans, form, planId]);

  const closeDialog = () => {
    form.reset(defaults());
    onOpenChange(false);
  };

  const saveSchedule = async (values: ScheduleMaintenanceFormValues) => {
    try {
      await scheduleMaintenance(values);
      appToast.success(
        "Maintenance scheduled successfully. The selected dates are now blocked for new bookings.",
      );
      closeDialog();
      onSaved();
    } catch (error) {
      const hasFieldErrors = applyMaintenanceServerErrors(
        error,
        form.setError,
        serverFieldMap,
      );
      const message = hasFieldErrors
        ? "Check the highlighted maintenance schedule fields."
        : "Maintenance could not be scheduled for the selected dates. Please try again.";

      form.setError("root", { message, type: "server" });
      appToast.error(message);
    }
  };

  const submit = form.handleSubmit(saveSchedule, () => {
    appToast.error("Check the highlighted maintenance schedule fields.");
  });

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) closeDialog();
    }}>
      <FormDialogContent width="wide">
        <FormDialogHeader
          title="Schedule Maintenance"
          icon={CalendarClock}
          onClose={closeDialog}
          closeLabel="Close maintenance schedule form"
        />

        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="grid flex-1 gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="vehicleId"
              render={({ field }) => (
                <SelectWithLabel
                  id="maintenance-schedule-vehicle"
                  label="Vehicle"
                  required
                  options={vehicles.map((vehicle) => ({ value: vehicle.id, label: vehicle.name }))}
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                  disabled={Boolean(fixedVehicleId)}
                  error={form.formState.errors.vehicleId?.message}
                />
              )}
            />
            <Controller
              control={form.control}
              name="planId"
              render={({ field }) => (
                <SelectWithLabel
                  id="maintenance-schedule-plan"
                  label="Maintenance Plan (Optional)"
                  options={[
                    { value: CUSTOM_PLAN_VALUE, label: "Custom maintenance" },
                    ...availablePlans.map((plan) => ({ value: plan.id, label: plan.name })),
                  ]}
                  value={field.value || CUSTOM_PLAN_VALUE}
                  onValueChange={(value) => field.onChange(
                    value === CUSTOM_PLAN_VALUE ? "" : value,
                  )}
                  disabled={!vehicleId}
                  error={form.formState.errors.planId?.message}
                />
              )}
            />

            {!planId ? (
              <>
                <InputWithLabel
                  id="maintenance-schedule-title"
                  label="Title"
                  required
                  error={form.formState.errors.title?.message}
                  {...form.register("title")}
                />
                <Controller
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <SelectWithLabel
                      id="maintenance-schedule-category"
                      label="Category"
                      required
                      options={[...maintenanceCategoryOptions]}
                      value={field.value}
                      onValueChange={field.onChange}
                      error={form.formState.errors.category?.message}
                    />
                  )}
                />
              </>
            ) : null}

            <InputWithLabel
              id="maintenance-schedule-start"
              label="Start Date and Time"
              required
              type="datetime-local"
              error={form.formState.errors.scheduledStart?.message}
              {...form.register("scheduledStart")}
            />
            <InputWithLabel
              id="maintenance-schedule-end"
              label="Expected End"
              required
              type="datetime-local"
              error={form.formState.errors.scheduledEnd?.message}
              {...form.register("scheduledEnd")}
            />

            {selectedVehicle ? (
              <div className="rounded-xl border border-border bg-background p-3 text-xs sm:col-span-2">
                <p className="font-bold text-foreground">
                  Known blocked booking and maintenance dates
                </p>
                {selectedVehicle.unavailableDateRanges?.length ? (
                  <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                    {selectedVehicle.unavailableDateRanges.map((range, index) => (
                      <li key={`${range.startDate}-${range.endDate}-${index}`} className="text-muted-foreground">
                        {range.startDate} → {range.endDate}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-muted-foreground">
                    No future blocked dates are currently listed.
                  </p>
                )}
              </div>
            ) : null}

            <InputWithLabel
              id="maintenance-schedule-provider"
              label="Service Provider (Optional)"
              error={form.formState.errors.serviceProvider?.message}
              {...form.register("serviceProvider")}
            />
            <InputWithLabel
              id="maintenance-schedule-technician"
              label="Technician (Optional)"
              error={form.formState.errors.technician?.message}
              {...form.register("technician")}
            />
            <TextAreaWithLabel
              id="maintenance-schedule-description"
              label="Description (Optional)"
              error={form.formState.errors.description?.message}
              {...form.register("description")}
            />
            <TextAreaWithLabel
              id="maintenance-schedule-notes"
              label="Internal Notes (Optional)"
              error={form.formState.errors.notes?.message}
              {...form.register("notes")}
            />
            {form.formState.errors.root?.message ? (
              <p className="text-[11px] font-medium text-destructive sm:col-span-2">
                {form.formState.errors.root.message}
              </p>
            ) : null}
          </div>

          <FormDialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Scheduling..." : "Schedule Maintenance"}
            </Button>
          </FormDialogFooter>
        </form>
      </FormDialogContent>
    </Dialog>
  );
}
