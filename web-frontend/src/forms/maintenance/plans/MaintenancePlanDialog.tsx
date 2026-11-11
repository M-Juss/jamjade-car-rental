"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useEffect } from "react";
import { Settings } from "lucide-react";
import {
  FormDialogContent,
  FormDialogFooter,
  FormDialogHeader,
} from "@/components/common/forms/FormDialogLayout";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { SelectWithLabel } from "@/components/common/forms/SelectWithLabel";
import { TextAreaWithLabel } from "@/components/common/forms/TextAreaWithLabel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
} from "@/components/ui/dialog";
import { appToast } from "@/lib/toast";
import {
  createMaintenancePlan,
  updateMaintenancePlan,
  type MaintenancePlan,
} from "@/services/maintenance";
import type { VehicleRecord } from "@/services/vehicle";
import {
  maintenancePlanSchema,
  type MaintenancePlanFormValues,
} from "@/validations/maintenance/schemas";
import {
  applyMaintenanceServerErrors,
  getMaintenancePlanPreview,
  maintenanceCategoryOptions,
  maintenancePlanDefaults,
  maintenanceTriggerOptions,
} from "../form-support";

const serverFieldMap = {
  vehicle_id: "vehicleId",
  name: "name",
  category: "category",
  description: "description",
  trigger_type: "triggerType",
  interval_km: "intervalKm",
  interval_days: "intervalDays",
} as const;

type MaintenancePlanDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: VehicleRecord[];
  fixedVehicleId?: string;
  editingPlan?: MaintenancePlan;
  onSaved: () => void;
};

export function MaintenancePlanDialog({
  open,
  onOpenChange,
  vehicles,
  fixedVehicleId,
  editingPlan,
  onSaved,
}: MaintenancePlanDialogProps) {
  const form = useForm<MaintenancePlanFormValues>({
    resolver: zodResolver(maintenancePlanSchema),
    defaultValues: maintenancePlanDefaults,
  });
  const triggerType = useWatch({
    control: form.control,
    name: "triggerType",
  });
  const vehicleId = useWatch({ control: form.control, name: "vehicleId" });
  const intervalKm = useWatch({ control: form.control, name: "intervalKm" });
  const intervalDays = useWatch({ control: form.control, name: "intervalDays" });
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const currentOdometer = selectedVehicle?.currentOdometer ?? editingPlan?.currentOdometer ?? null;
  const preview = getMaintenancePlanPreview({ currentOdometer, editingPlan, intervalKm, intervalDays });
  const mileageUnavailable = triggerType !== "date" && Boolean(vehicleId) && currentOdometer === null;

  useEffect(() => {
    if (!open) return;

    form.reset(editingPlan ? {
      vehicleId: editingPlan.vehicleId,
      name: editingPlan.name,
      category: editingPlan.category,
      description: editingPlan.description ?? "",
      triggerType: editingPlan.triggerType,
      intervalKm: editingPlan.intervalKm?.toString() ?? "",
      intervalDays: editingPlan.intervalDays?.toString() ?? "",
    } : {
      ...maintenancePlanDefaults,
      vehicleId: fixedVehicleId ?? "",
    });
  }, [editingPlan, fixedVehicleId, form, open]);

  const closeDialog = () => {
    form.reset(maintenancePlanDefaults);
    onOpenChange(false);
  };

  const savePlan = async (values: MaintenancePlanFormValues) => {
    const action = editingPlan ? "updated" : "created";

    try {
      if (editingPlan) {
        await updateMaintenancePlan(editingPlan.id, values);
      } else {
        await createMaintenancePlan(values);
      }

      appToast.success(`Maintenance plan ${action} successfully.`);
      closeDialog();
      onSaved();
    } catch (error) {
      const hasFieldErrors = applyMaintenanceServerErrors(
        error,
        form.setError,
        serverFieldMap,
      );
      const message = hasFieldErrors
        ? "Check the highlighted maintenance plan fields."
        : "The maintenance plan could not be saved. Please try again.";

      form.setError("root", { message, type: "server" });
      appToast.error(message);
    }
  };

  const submit = form.handleSubmit(savePlan, () => {
    appToast.error("Check the highlighted maintenance plan fields.");
  });

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) closeDialog();
    }}>
      <FormDialogContent>
        <FormDialogHeader
          title={editingPlan ? "Edit Maintenance Plan" : "Add Maintenance Plan"}
          icon={Settings}
          onClose={closeDialog}
          closeLabel="Close maintenance plan form"
        />

        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <section className="space-y-3" aria-labelledby="maintenance-plan-details-heading">
              <h2 id="maintenance-plan-details-heading" className="text-xs font-semibold normal-case tracking-normal text-muted-foreground">
                Plan Details
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Controller
                  control={form.control}
                  name="vehicleId"
                  render={({ field }) => (
                    <SelectWithLabel
                      id="maintenance-plan-vehicle"
                      label="Vehicle"
                      required
                      options={vehicles.map((vehicle) => ({ value: vehicle.id, label: [vehicle.name, vehicle.plateNumber].filter(Boolean).join(" ") }))}
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      disabled={Boolean(fixedVehicleId)}
                      error={form.formState.errors.vehicleId?.message}
                    />
                  )}
                />
                <InputWithLabel
                  id="maintenance-plan-name"
                  label="Maintenance Name"
                  required
                  placeholder="Oil Change"
                  error={form.formState.errors.name?.message}
                  {...form.register("name")}
                />
                <Controller
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <SelectWithLabel
                      id="maintenance-plan-category"
                      label="Category"
                      required
                      options={[...maintenanceCategoryOptions]}
                      value={field.value}
                      onValueChange={field.onChange}
                      error={form.formState.errors.category?.message}
                      wrapperClassName="md:col-span-2"
                    />
                  )}
                />
              </div>
            </section>

            <section className="space-y-4 border-t border-border pt-5" aria-labelledby="maintenance-plan-schedule-heading">
              <div>
                <h2 id="maintenance-plan-schedule-heading" className="text-xs font-semibold normal-case tracking-normal text-muted-foreground">
                  Schedule
                </h2>
                <div className="mt-3">
                  <Controller
                    control={form.control}
                    name="triggerType"
                    render={({ field }) => (
                      <SelectWithLabel
                        id="maintenance-plan-trigger"
                        label="Trigger"
                        required
                        options={[...maintenanceTriggerOptions]}
                        value={field.value}
                        onValueChange={field.onChange}
                        error={form.formState.errors.triggerType?.message}
                        wrapperClassName="md:col-span-2"
                      />
                    )}
                  />
                </div>
              </div>

              {triggerType !== "date" ? (
                <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
                  <h3 className="text-xs font-semibold normal-case tracking-normal text-subtle-foreground">
                    Mileage Schedule
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Controller
                      control={form.control}
                      name="intervalKm"
                      render={({ field }) => (
                        <InputWithLabel
                          {...field}
                          value={field.value ?? ""}
                          id="maintenance-plan-interval-km"
                          label="Interval (km)"
                          required
                          inputMode="numeric"
                          pattern="[0-9]*"
                          onChange={(event) => {
                            if (/^\d*$/.test(event.target.value)) field.onChange(event);
                          }}
                          error={form.formState.errors.intervalKm?.message}
                        />
                      )}
                    />
                    <InputWithLabel
                      id="maintenance-plan-current-odometer"
                      label="Current Odometer"
                      readOnly
                      value={preview.currentOdometer}
                    />
                    <InputWithLabel
                      id="maintenance-plan-next-odometer"
                      label="Next Due Odometer"
                      readOnly
                      value={preview.nextDueOdometer}
                      wrapperClassName="md:col-span-2"
                    />
                  </div>
                </div>
              ) : null}

              {triggerType !== "mileage" ? (
                <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
                  <h3 className="text-xs font-semibold normal-case tracking-normal text-subtle-foreground">
                    Date Schedule
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Controller
                      control={form.control}
                      name="intervalDays"
                      render={({ field }) => (
                        <InputWithLabel
                          {...field}
                          value={field.value ?? ""}
                          id="maintenance-plan-interval-days"
                          label="Interval (days)"
                          required
                          inputMode="numeric"
                          pattern="[0-9]*"
                          onChange={(event) => {
                            if (/^\d*$/.test(event.target.value)) field.onChange(event);
                          }}
                          error={form.formState.errors.intervalDays?.message}
                        />
                      )}
                    />
                    <InputWithLabel
                      id="maintenance-plan-current-date"
                      label="Current Date"
                      readOnly
                      value={preview.currentDate}
                    />
                    <InputWithLabel
                      id="maintenance-plan-next-date"
                      label="Next Due Date"
                      readOnly
                      value={preview.nextDueDate}
                      wrapperClassName="md:col-span-2"
                    />
                  </div>
                </div>
              ) : null}

              {mileageUnavailable ? (
                <p className="rounded-xl border border-warning-border bg-warning-surface p-3 text-xs text-warning">
                  This vehicle has no Current Condition odometer. Set its Current Condition before creating a mileage-based plan.
                </p>
              ) : null}
            </section>

            <section className="space-y-3 border-t border-border pt-5" aria-labelledby="maintenance-plan-notes-heading">
              <h2 id="maintenance-plan-notes-heading" className="text-xs font-semibold normal-case tracking-normal text-muted-foreground">
                Notes
              </h2>
              <TextAreaWithLabel
                id="maintenance-plan-description"
                label="Description (Optional)"
                wrapperClassName="md:col-span-2"
                error={form.formState.errors.description?.message}
                {...form.register("description")}
              />
            </section>

            {form.formState.errors.root?.message ? (
              <p className="text-xs font-medium text-destructive">
                {form.formState.errors.root.message}
              </p>
            ) : null}
          </div>

          <FormDialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting || mileageUnavailable}>
              {form.formState.isSubmitting
                ? "Saving..."
                : editingPlan
                  ? "Save Changes"
                  : "Create Plan"}
            </Button>
          </FormDialogFooter>
        </form>
      </FormDialogContent>
    </Dialog>
  );
}
