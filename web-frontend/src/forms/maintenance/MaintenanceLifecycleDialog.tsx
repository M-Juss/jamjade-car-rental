"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { InputWithLabel } from "@/components/common/InputWithLabel";
import { TextAreaWithLabel } from "@/components/common/TextAreaWithLabel";
import {
  FormDialogContent,
  FormDialogFooter,
  FormDialogHeader,
} from "@/components/common/FormDialogLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
} from "@/components/ui/dialog";
import { appToast } from "@/lib/toast";
import {
  completeMaintenance,
  startMaintenance,
  type MaintenanceRecord,
} from "@/services/maintenance";
import {
  completeMaintenanceSchema,
  type CompleteMaintenanceFormValues,
} from "@/validations/maintenance/schemas";
import {
  applyMaintenanceServerErrors,
  completeMaintenanceDefaults,
} from "./form-support";

const serverFieldMap = {
  odometer_at_completion: "odometerAtCompletion",
  work_performed: "workPerformed",
  service_provider: "serviceProvider",
  technician: "technician",
  labor_cost: "laborCost",
  parts_cost: "partsCost",
  other_cost: "otherCost",
  notes: "notes",
} as const;

type MaintenanceLifecycleDialogProps = {
  record: MaintenanceRecord | null;
  mode: "start" | "complete" | null;
  onOpenChange: () => void;
  onSaved: () => void;
};

export function MaintenanceLifecycleDialog({
  record,
  mode,
  onOpenChange,
  onSaved,
}: MaintenanceLifecycleDialogProps) {
  const [isStarting, setIsStarting] = useState(false);
  const form = useForm<CompleteMaintenanceFormValues>({
    resolver: zodResolver(completeMaintenanceSchema),
    defaultValues: completeMaintenanceDefaults,
  });

  useEffect(() => {
    if (record && mode === "complete") {
      form.reset({
        ...completeMaintenanceDefaults,
        odometerAtCompletion: String(
          record.odometerAtStart ?? record.vehicle?.currentOdometer ?? "",
        ),
      });
    }
  }, [form, mode, record]);

  if (!record || !mode) return null;

  const closeDialog = () => {
    form.reset(completeMaintenanceDefaults);
    onOpenChange();
  };

  const start = async () => {
    try {
      setIsStarting(true);
      await startMaintenance(record.id);
      appToast.success(
        "Maintenance started successfully. The current vehicle odometer was recorded automatically.",
      );
      closeDialog();
      onSaved();
    } catch {
      appToast.error("Maintenance could not be started. Please try again.");
    } finally {
      setIsStarting(false);
    }
  };

  const complete = async (values: CompleteMaintenanceFormValues) => {
    try {
      await completeMaintenance(record.id, values);
      appToast.success(
        "Maintenance completed successfully. Any unused scheduled time was released.",
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
        ? "Check the highlighted maintenance completion fields."
        : "Maintenance could not be completed. Please try again.";

      form.setError("root", { message, type: "server" });
      appToast.error(message);
    }
  };

  const submit = form.handleSubmit(complete, () => {
    appToast.error("Check the highlighted maintenance completion fields.");
  });
  const isStartMode = mode === "start";
  const HeaderIcon = isStartMode ? Play : CheckCircle2;

  return (
    <Dialog open onOpenChange={(nextOpen) => {
      if (!nextOpen) closeDialog();
    }}>
      <FormDialogContent>
        <FormDialogHeader
          title={isStartMode ? "Start Maintenance" : "Complete Maintenance"}
          icon={HeaderIcon}
          onClose={closeDialog}
          closeLabel="Close maintenance action"
        />

        {isStartMode ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
              <p className="text-xs font-semibold text-foreground">
                {record.vehicle?.name} · {record.title}
              </p>
              <p className="rounded-xl border border-border bg-background p-4 text-[12.5px] leading-5 text-muted-foreground">
                The current vehicle odometer (
                {record.vehicle?.currentOdometer?.toLocaleString() ?? "not recorded"} km)
                will be recorded automatically when maintenance starts.
              </p>
            </div>
            <FormDialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void start()} disabled={isStarting}>
                {isStarting ? "Starting..." : "Start Maintenance"}
              </Button>
            </FormDialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="grid flex-1 gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
              <InputWithLabel
                id="maintenance-completion-odometer"
                label="Completion Odometer"
                required
                inputMode="numeric"
                error={form.formState.errors.odometerAtCompletion?.message}
                {...form.register("odometerAtCompletion")}
              />
              <InputWithLabel
                id="maintenance-completion-provider"
                label="Service Provider (Optional)"
                error={form.formState.errors.serviceProvider?.message}
                {...form.register("serviceProvider")}
              />
              <TextAreaWithLabel
                id="maintenance-completion-work"
                label="Work Performed"
                required
                error={form.formState.errors.workPerformed?.message}
                {...form.register("workPerformed")}
              />
              <InputWithLabel
                id="maintenance-completion-technician"
                label="Technician (Optional)"
                error={form.formState.errors.technician?.message}
                {...form.register("technician")}
              />
              <InputWithLabel
                id="maintenance-completion-labor-cost"
                label="Labor Cost (Optional)"
                inputMode="decimal"
                error={form.formState.errors.laborCost?.message}
                {...form.register("laborCost")}
              />
              <InputWithLabel
                id="maintenance-completion-parts-cost"
                label="Parts Cost (Optional)"
                inputMode="decimal"
                error={form.formState.errors.partsCost?.message}
                {...form.register("partsCost")}
              />
              <InputWithLabel
                id="maintenance-completion-other-cost"
                label="Other Cost (Optional)"
                inputMode="decimal"
                error={form.formState.errors.otherCost?.message}
                {...form.register("otherCost")}
              />
              <TextAreaWithLabel
                id="maintenance-completion-notes"
                label="Completion Notes (Optional)"
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
                {form.formState.isSubmitting ? "Completing..." : "Complete Maintenance"}
              </Button>
            </FormDialogFooter>
          </form>
        )}
      </FormDialogContent>
    </Dialog>
  );
}
