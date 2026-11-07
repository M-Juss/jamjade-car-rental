"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarRange } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { FormDialogContent, FormDialogFooter, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import { MaintenanceScheduleDateField } from "./MaintenanceScheduleDateField";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { appToast } from "@/lib/toast";
import { rescheduleMaintenance, type MaintenanceRecord } from "@/services/maintenance";
import { maintenanceDateKey } from "@/services/maintenance/dates";
import type { VehicleRecord } from "@/services/vehicle";
import {
  createRescheduleMaintenanceSchema,
  type RescheduleMaintenanceFormValues,
} from "@/validations/maintenance/schemas";
import { applyMaintenanceServerErrors, getMaintenanceScheduleDateLimits, rescheduleMaintenanceDefaults } from "../form-support";

const serverFieldMap = {
  scheduled_start: "scheduledStart",
  scheduled_end: "scheduledEnd",
  status: "scheduledStart",
} as const;

export function RescheduleMaintenanceDialog({
  record,
  vehicle,
  onOpenChange,
  onSaved,
}: {
  record: MaintenanceRecord | null;
  vehicle?: VehicleRecord;
  onOpenChange: () => void;
  onSaved: () => void;
}) {
  const ranges = useMemo(() => (vehicle?.unavailableDateRanges ?? []).filter((range) => !(
    range.source === "maintenance"
    && range.startDate === (record ? maintenanceDateKey(record.scheduledStart) : undefined)
    && range.endDate === (record ? maintenanceDateKey(record.scheduledEnd) : undefined)
  )), [record, vehicle]);
  const schema = useMemo(() => createRescheduleMaintenanceSchema(ranges), [ranges]);
  const form = useForm<RescheduleMaintenanceFormValues>({
    resolver: zodResolver(schema),
    defaultValues: rescheduleMaintenanceDefaults,
  });
  const scheduledStart = useWatch({ control: form.control, name: "scheduledStart" });
  const dateLimits = getMaintenanceScheduleDateLimits(scheduledStart);
  useEffect(() => {
    if (record) form.reset({
      scheduledStart: maintenanceDateKey(record.scheduledStart),
      scheduledEnd: maintenanceDateKey(record.scheduledEnd),
    });
  }, [form, record]);

  if (!record) return null;
  const close = () => { form.reset(rescheduleMaintenanceDefaults); onOpenChange(); };
  const save = async (values: RescheduleMaintenanceFormValues) => {
    try {
      await rescheduleMaintenance(record.id, values);
      appToast.success("Maintenance rescheduled successfully. The selected dates were updated.");
      close();
      onSaved();
    } catch (error) {
      const hasFieldErrors = applyMaintenanceServerErrors(error, form.setError, serverFieldMap);
      const message = hasFieldErrors
        ? "Check the highlighted reschedule fields."
        : "Maintenance could not be rescheduled. Please try again.";
      form.setError("root", { message, type: "server" });
      appToast.error(message);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <FormDialogContent width="wide">
        <FormDialogHeader title="Reschedule Maintenance" icon={CalendarRange} onClose={close} closeLabel="Close reschedule form" />
        <form onSubmit={form.handleSubmit(save, () => appToast.error("Check the highlighted reschedule fields."))} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="grid flex-1 gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-background p-3 sm:col-span-2">
              <p className="text-xs font-semibold normal-case tracking-normal text-subtle-foreground">{record.vehicle?.name}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{record.title}</p>
            </div>
            <Controller
              control={form.control}
              name="scheduledStart"
              render={({ field, fieldState }) => (
                <MaintenanceScheduleDateField {...field} id="maintenance-reschedule-start" label="Start Date" required min={dateLimits.start} error={fieldState.error?.message} />
              )}
            />
            <Controller
              control={form.control}
              name="scheduledEnd"
              render={({ field, fieldState }) => (
                <MaintenanceScheduleDateField {...field} id="maintenance-reschedule-end" label="Expected End Date" required min={dateLimits.end} error={fieldState.error?.message} />
              )}
            />
            {form.formState.errors.root?.message ? <p className="text-xs font-medium text-destructive sm:col-span-2">{form.formState.errors.root.message}</p> : null}
          </div>
          <FormDialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Rescheduling..." : "Save New Schedule"}</Button>
          </FormDialogFooter>
        </form>
      </FormDialogContent>
    </Dialog>
  );
}
