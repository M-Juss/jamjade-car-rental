"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { FormDialogContent, FormDialogFooter, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { SelectWithLabel } from "@/components/common/forms/SelectWithLabel";
import { TextAreaWithLabel } from "@/components/common/forms/TextAreaWithLabel";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { appToast } from "@/lib/toast";
import { completeMaintenance, startMaintenance, type MaintenanceRecord } from "@/services/maintenance";
import {
  createCompleteMaintenanceSchema,
  type CompleteMaintenanceFormValues,
} from "@/validations/maintenance/schemas";
import { applyMaintenanceServerErrors, completeMaintenanceDefaults } from "../form-support";

const serverFieldMap = {
  odometer_at_completion: "odometerAtCompletion",
  service_provider: "serviceProvider",
  labor_cost: "laborCost",
  parts_cost: "partsCost",
  other_cost: "otherCost",
  notes: "notes",
  condition_changed: "conditionChanged",
} as const;

type MaintenanceLifecycleDialogProps = {
  record: MaintenanceRecord | null;
  mode: "start" | "complete" | null;
  onOpenChange: () => void;
  onSaved: () => void;
  onConditionRequired: (record: MaintenanceRecord) => void;
};

function formatDate(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value))
    : "—";
}

function formatDateOnly(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(value))
    : "—";
}

export function MaintenanceLifecycleDialog({
  record,
  mode,
  onOpenChange,
  onSaved,
  onConditionRequired,
}: MaintenanceLifecycleDialogProps) {
  const [isStarting, setIsStarting] = useState(false);
  const requireOdometer = Boolean(record?.plan && record.plan.triggerType !== "date");
  const requireConditionDecision = Boolean(record && ["corrective", "other"].includes(record.category));
  const forceConditionVerification = record?.category === "body_repair";
  const schema = useMemo(() => createCompleteMaintenanceSchema({
    requireOdometer,
    requireConditionDecision,
    forceConditionVerification,
  }), [forceConditionVerification, requireConditionDecision, requireOdometer]);
  const form = useForm<CompleteMaintenanceFormValues>({
    resolver: zodResolver(schema),
    defaultValues: completeMaintenanceDefaults,
  });
  const costs = useWatch({ control: form.control, name: ["laborCost", "partsCost", "otherCost"] });
  const totalCost = costs.reduce((sum, value) => sum + (Number(value) || 0), 0);

  useEffect(() => {
    if (record && mode === "complete") {
      form.reset({
        ...completeMaintenanceDefaults,
        odometerAtCompletion: String(record.odometerAtStart ?? record.vehicle?.currentOdometer ?? ""),
        serviceProvider: record.serviceProvider ?? "",
        conditionChanged: record.category === "body_repair" ? "yes" : undefined,
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
      appToast.success("Maintenance started successfully.");
      closeDialog();
      onSaved();
    } catch {
      appToast.error("Maintenance could not be started. Please try again.");
    } finally {
      setIsStarting(false);
    }
  };

  const complete = async (values: CompleteMaintenanceFormValues) => {
    if (!record.serviceProvider && !values.serviceProvider?.trim()) {
      form.setError("serviceProvider", { message: "Enter the service provider." });
      appToast.error("Enter the service provider.");
      return;
    }
    try {
      const updated = await completeMaintenance(record.id, values);
      closeDialog();
      if (updated.conditionVerificationRequired && updated.status === "in_progress") {
        appToast.success("Completion details saved. Continue to Vehicle Condition verification.");
        onConditionRequired(updated);
      } else {
        appToast.success("Maintenance completed successfully. Unused scheduled time was released.");
        onSaved();
      }
    } catch (error) {
      const hasFieldErrors = applyMaintenanceServerErrors(error, form.setError, serverFieldMap);
      const message = hasFieldErrors
        ? "Check the highlighted maintenance completion fields."
        : "Maintenance could not be completed. Please try again.";
      form.setError("root", { message, type: "server" });
      appToast.error(message);
    }
  };
  const isStartMode = mode === "start";
  const HeaderIcon = isStartMode ? Play : CheckCircle2;

  return (
    <Dialog open onOpenChange={(nextOpen) => { if (!nextOpen) closeDialog(); }}>
      <FormDialogContent width={isStartMode ? "compact" : "wide"}>
        <FormDialogHeader
          title={isStartMode ? "Start Maintenance" : "Complete Maintenance"}
          icon={HeaderIcon}
          onClose={closeDialog}
          closeLabel="Close maintenance action"
        />
        {isStartMode ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="grid flex-1 gap-3 overflow-y-auto px-6 py-5 sm:grid-cols-2">
              {[
                ["Vehicle", record.vehicle?.name ?? "—"],
                ["Maintenance", record.title],
                ["Service Provider", record.serviceProvider ?? "Not specified"],
                ["Schedule", `${formatDateOnly(record.scheduledStart)} – ${formatDateOnly(record.scheduledEnd)}`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border bg-background p-3">
                  <p className="text-xs font-semibold normal-case tracking-normal text-subtle-foreground">{label}</p>
                  <p className="mt-1 text-xs font-semibold text-foreground">{value}</p>
                </div>
              ))}
            </div>
            <FormDialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="button" onClick={() => void start()} disabled={isStarting}>
                {isStarting ? "Starting..." : "Start Maintenance"}
              </Button>
            </FormDialogFooter>
          </div>
        ) : (
          <form
            onSubmit={form.handleSubmit(complete, () => appToast.error("Check the highlighted maintenance completion fields."))}
            noValidate
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="grid flex-1 gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
              <div className="grid gap-3 rounded-2xl border border-border bg-background p-4 sm:col-span-2 sm:grid-cols-4">
                {[
                  ["Vehicle", record.vehicle?.name ?? "—"],
                  ["Maintenance", record.title],
                  ["Category", record.categoryLabel],
                  ["Actual Start", formatDate(record.actualStartedAt)],
                ].map(([label, value]) => (
                  <div key={label}><p className="text-xs font-semibold normal-case tracking-normal text-subtle-foreground">{label}</p><p className="mt-1 text-xs font-semibold text-foreground">{value}</p></div>
                ))}
              </div>
              {record.serviceProvider ? <InputWithLabel id="maintenance-completion-saved-provider" label="Service Provider" value={record.serviceProvider} disabled inputClassName="disabled:opacity-100" /> : <InputWithLabel
                id="maintenance-completion-provider"
                label="Service Provider"
                required
                error={form.formState.errors.serviceProvider?.message}
                {...form.register("serviceProvider")}
              />}
              <InputWithLabel
                id="maintenance-completion-odometer"
                label={requireOdometer ? "Completion Odometer" : "Completion Odometer (Optional)"}
                required={requireOdometer}
                inputFormat="integer"
                error={form.formState.errors.odometerAtCompletion?.message}
                {...form.register("odometerAtCompletion")}
              />
              {(requireConditionDecision || forceConditionVerification) ? (
                <Controller
                  control={form.control}
                  name="conditionChanged"
                  render={({ field }) => (
                    <SelectWithLabel
                      id="maintenance-condition-changed"
                      label="Did tracked vehicle condition change?"
                      required
                      options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      disabled={forceConditionVerification}
                      error={form.formState.errors.conditionChanged?.message}
                    />
                  )}
                />
              ) : null}
              <InputWithLabel id="maintenance-completion-labor-cost" label="Labor Cost" required wrapperClassName="sm:col-span-2" inputFormat="decimal" error={form.formState.errors.laborCost?.message} {...form.register("laborCost")} />
              <InputWithLabel id="maintenance-completion-parts-cost" label="Parts Cost" required wrapperClassName="sm:col-span-2" inputFormat="decimal" error={form.formState.errors.partsCost?.message} {...form.register("partsCost")} />
              <InputWithLabel id="maintenance-completion-other-cost" label="Other Cost" required wrapperClassName="sm:col-span-2" inputFormat="decimal" error={form.formState.errors.otherCost?.message} {...form.register("otherCost")} />
              <InputWithLabel id="maintenance-completion-total" label="Total Cost" wrapperClassName="sm:col-span-2" readOnly value={new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(totalCost)} />
              <TextAreaWithLabel id="maintenance-completion-notes" label="Completion Notes (Optional)" wrapperClassName="sm:col-span-2" error={form.formState.errors.notes?.message} {...form.register("notes")} />
              {forceConditionVerification ? (
                <p className="rounded-xl border border-warning-border bg-warning-surface p-3 text-xs text-warning sm:col-span-2">
                  Body Repair remains In Progress until the resulting Vehicle Condition update is signed and finalized.
                </p>
              ) : null}
              {form.formState.errors.root?.message ? <p className="text-xs font-medium text-destructive sm:col-span-2">{form.formState.errors.root.message}</p> : null}
            </div>
            <FormDialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "Saving..."
                  : (forceConditionVerification ? "Continue to Condition Verification" : "Complete Maintenance")}
              </Button>
            </FormDialogFooter>
          </form>
        )}
      </FormDialogContent>
    </Dialog>
  );
}
