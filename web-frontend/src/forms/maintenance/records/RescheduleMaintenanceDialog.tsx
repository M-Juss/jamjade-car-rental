"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarRange } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { FormDialogContent, FormDialogFooter, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { appToast } from "@/lib/toast";
import { rescheduleMaintenance, type MaintenanceRecord } from "@/services/maintenance";
import type { VehicleRecord } from "@/services/vehicle";
import {
  createRescheduleMaintenanceSchema,
  type RescheduleMaintenanceFormValues,
} from "@/validations/maintenance/schemas";
import { applyMaintenanceServerErrors, rescheduleMaintenanceDefaults } from "../form-support";

const serverFieldMap = {
  scheduled_start: "scheduledStart",
  scheduled_end: "scheduledEnd",
  status: "scheduledStart",
} as const;

function localDateKey(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

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
    && range.startDate === (record ? localDateKey(record.scheduledStart) : undefined)
    && range.endDate === (record ? localDateKey(record.scheduledEnd) : undefined)
  )), [record, vehicle]);
  const schema = useMemo(() => createRescheduleMaintenanceSchema(ranges), [ranges]);
  const form = useForm<RescheduleMaintenanceFormValues>({
    resolver: zodResolver(schema),
    defaultValues: rescheduleMaintenanceDefaults,
  });
  useEffect(() => {
    if (record) form.reset({
      scheduledStart: localDateKey(record.scheduledStart),
      scheduledEnd: localDateKey(record.scheduledEnd),
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
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-subtle-foreground">{record.vehicle?.name}</p>
              <p className="mt-1 text-sm font-bold text-foreground">{record.title}</p>
            </div>
            <InputWithLabel id="maintenance-reschedule-start" label="Start Date" required type="date" error={form.formState.errors.scheduledStart?.message} {...form.register("scheduledStart")} />
            <InputWithLabel id="maintenance-reschedule-end" label="Expected End Date" required type="date" error={form.formState.errors.scheduledEnd?.message} {...form.register("scheduledEnd")} />
            {form.formState.errors.root?.message ? <p className="text-[11px] font-medium text-destructive sm:col-span-2">{form.formState.errors.root.message}</p> : null}
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
