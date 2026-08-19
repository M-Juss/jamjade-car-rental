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
  const mileageBaseline = editingPlan?.lastCompletedOdometer
    ?? editingPlan?.baselineOdometer
    ?? currentOdometer;
  const nextDueOdometer = mileageBaseline !== null && mileageBaseline !== undefined && intervalKm
    ? mileageBaseline + Number(intervalKm)
    : null;
  const dateBaseline = editingPlan?.lastCompletedAt?.slice(0, 10)
    ?? editingPlan?.baselineDate
    ?? new Date().toISOString().slice(0, 10);
  const nextDueDate = intervalDays
    ? new Date(new Date(`${dateBaseline}T12:00:00`).setDate(
        new Date(`${dateBaseline}T12:00:00`).getDate() + Number(intervalDays),
      )).toISOString().slice(0, 10)
    : "";
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
          <div className="grid flex-1 gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="vehicleId"
              render={({ field }) => (
                <SelectWithLabel
                  id="maintenance-plan-vehicle"
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
                />
              )}
            />
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
                />
              )}
            />
            {triggerType !== "date" ? (
              <>
                <InputWithLabel
                  id="maintenance-plan-interval-km"
                  label="Interval (km)"
                  required
                  inputMode="numeric"
                  error={form.formState.errors.intervalKm?.message}
                  {...form.register("intervalKm")}
                />
                <InputWithLabel
                  id="maintenance-plan-current-odometer"
                  label="Current Odometer"
                  readOnly
                  value={currentOdometer == null ? "" : `${currentOdometer.toLocaleString()} km`}
                />
                <InputWithLabel
                  id="maintenance-plan-next-odometer"
                  label="Next Due Odometer"
                  readOnly
                  value={nextDueOdometer == null ? "" : `${nextDueOdometer.toLocaleString()} km`}
                />
              </>
            ) : null}
            {triggerType !== "mileage" ? (
              <>
                <InputWithLabel
                  id="maintenance-plan-interval-days"
                  label="Interval (days)"
                  required
                  inputMode="numeric"
                  error={form.formState.errors.intervalDays?.message}
                  {...form.register("intervalDays")}
                />
                <InputWithLabel
                  id="maintenance-plan-current-date"
                  label="Current Date"
                  readOnly
                  value={new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date())}
                />
                <InputWithLabel
                  id="maintenance-plan-next-date"
                  label="Next Due Date"
                  readOnly
                  value={nextDueDate}
                />
              </>
            ) : null}
            <TextAreaWithLabel
              id="maintenance-plan-description"
              label="Description (Optional)"
              wrapperClassName="sm:col-span-2"
              error={form.formState.errors.description?.message}
              {...form.register("description")}
            />
            {mileageUnavailable ? (
              <p className="rounded-xl border border-warning-border bg-warning-surface p-3 text-xs text-warning sm:col-span-2">
                This vehicle has no Current Condition odometer. Set its Current Condition before creating a mileage-based plan.
              </p>
            ) : null}
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
