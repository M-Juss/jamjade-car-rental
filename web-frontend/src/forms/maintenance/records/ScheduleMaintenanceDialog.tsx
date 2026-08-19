"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock } from "lucide-react";
import { useCallback, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { FormDialogContent, FormDialogFooter, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { SelectWithLabel } from "@/components/common/forms/SelectWithLabel";
import { TextAreaWithLabel } from "@/components/common/forms/TextAreaWithLabel";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { appToast } from "@/lib/toast";
import { scheduleMaintenance, type MaintenancePlan } from "@/services/maintenance";
import type { VehicleRecord } from "@/services/vehicle";
import {
  createScheduleMaintenanceSchema,
  type ScheduleMaintenanceFormValues,
} from "@/validations/maintenance/schemas";
import {
  applyMaintenanceServerErrors,
  maintenanceCategoryOptions,
  scheduleMaintenanceDefaults,
} from "../form-support";

const serverFieldMap = {
  vehicle_id: "vehicleId",
  maintenance_plan_id: "planId",
  title: "title",
  category: "category",
  scheduled_start: "scheduledStart",
  scheduled_end: "scheduledEnd",
  service_provider: "serviceProvider",
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
  const initialPlan = initialPlanId ? plans.find((plan) => plan.id === initialPlanId) : undefined;
  const defaults = useCallback((): ScheduleMaintenanceFormValues => ({
    ...scheduleMaintenanceDefaults,
    vehicleId: fixedVehicleId ?? initialPlan?.vehicleId ?? "",
    planId: initialPlan?.id ?? "",
  }), [fixedVehicleId, initialPlan]);
  const form = useForm<ScheduleMaintenanceFormValues>({
    resolver: async (values, context, options) => zodResolver(
      createScheduleMaintenanceSchema(
        vehicles.find((vehicle) => vehicle.id === values.vehicleId)?.unavailableDateRanges ?? [],
      ),
    )(values, context, options),
    defaultValues: defaults(),
  });
  const isPlanSchedule = Boolean(initialPlan);

  useEffect(() => {
    if (open) form.reset(defaults());
  }, [defaults, form, open]);

  const closeDialog = () => {
    form.reset(defaults());
    onOpenChange(false);
  };

  const saveSchedule = async (values: ScheduleMaintenanceFormValues) => {
    try {
      await scheduleMaintenance(values);
      appToast.success("Maintenance scheduled successfully. The selected dates now block new bookings.");
      closeDialog();
      onSaved();
    } catch (error) {
      const hasFieldErrors = applyMaintenanceServerErrors(error, form.setError, serverFieldMap);
      const message = hasFieldErrors
        ? "Check the highlighted maintenance schedule fields."
        : "Maintenance could not be scheduled for the selected dates. Please try again.";
      form.setError("root", { message, type: "server" });
      appToast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) closeDialog(); }}>
      <FormDialogContent width="wide">
        <FormDialogHeader
          title={isPlanSchedule ? "Schedule Maintenance" : "Schedule Custom Maintenance"}
          icon={CalendarClock}
          onClose={closeDialog}
          closeLabel="Close maintenance schedule form"
        />
        <form
          onSubmit={form.handleSubmit(saveSchedule, () => appToast.error("Check the highlighted maintenance schedule fields."))}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="grid flex-1 gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            {isPlanSchedule ? (
              <>
                <InputWithLabel
                  id="maintenance-schedule-plan-vehicle"
                  label="Vehicle"
                  readOnly
                  value={initialPlan?.vehicle?.name ?? ""}
                />
                <InputWithLabel
                  id="maintenance-schedule-plan-category"
                  label="Category"
                  readOnly
                  value={initialPlan?.categoryLabel ?? ""}
                />
                <InputWithLabel
                  id="maintenance-schedule-plan-name"
                  label="Maintenance Name"
                  readOnly
                  wrapperClassName="sm:col-span-2"
                  value={initialPlan?.name ?? ""}
                />
                <div className="grid w-full gap-1.5 sm:col-span-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-subtle-foreground">Description</p>
                  <p className="min-h-20 whitespace-pre-wrap rounded-xl border border-border bg-background px-3 py-2.5 text-[12.5px] text-foreground">
                    {initialPlan?.description || ""}
                  </p>
                </div>
              </>
            ) : (
              <>
                <Controller
                  control={form.control}
                  name="vehicleId"
                  render={({ field }) => (
                    <SelectWithLabel
                      id="maintenance-schedule-vehicle"
                      label="Vehicle"
                      required
                      options={vehicles.map((vehicle) => ({ value: vehicle.id, label: vehicle.name }))}
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      disabled={Boolean(fixedVehicleId)}
                      error={form.formState.errors.vehicleId?.message}
                    />
                  )}
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
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      error={form.formState.errors.category?.message}
                    />
                  )}
                />
                <InputWithLabel
                  id="maintenance-schedule-title"
                  label="Maintenance Name"
                  required
                  wrapperClassName="sm:col-span-2"
                  error={form.formState.errors.title?.message}
                  {...form.register("title")}
                />
                <TextAreaWithLabel
                  id="maintenance-schedule-description"
                  label="Description (Optional)"
                  wrapperClassName="sm:col-span-2"
                  error={form.formState.errors.description?.message}
                  {...form.register("description")}
                />
              </>
            )}

            <InputWithLabel
              id="maintenance-schedule-start"
              label="Start Date"
              required
              type="date"
              error={form.formState.errors.scheduledStart?.message}
              {...form.register("scheduledStart")}
            />
            <InputWithLabel
              id="maintenance-schedule-end"
              label="Expected End Date"
              required
              type="date"
              error={form.formState.errors.scheduledEnd?.message}
              {...form.register("scheduledEnd")}
            />
            <InputWithLabel
              id="maintenance-schedule-provider"
              label="Service Provider (Optional)"
              wrapperClassName="sm:col-span-2"
              error={form.formState.errors.serviceProvider?.message}
              {...form.register("serviceProvider")}
            />
            <TextAreaWithLabel
              id="maintenance-schedule-notes"
              label="Internal Notes (Optional)"
              wrapperClassName="sm:col-span-2"
              error={form.formState.errors.notes?.message}
              {...form.register("notes")}
            />
            {form.formState.errors.root?.message ? (
              <p className="text-[11px] font-medium text-destructive sm:col-span-2">{form.formState.errors.root.message}</p>
            ) : null}
          </div>
          <FormDialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Scheduling..." : "Schedule Maintenance"}
            </Button>
          </FormDialogFooter>
        </form>
      </FormDialogContent>
    </Dialog>
  );
}
