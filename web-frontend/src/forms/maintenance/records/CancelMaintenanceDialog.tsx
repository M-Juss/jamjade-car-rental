"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { TextAreaWithLabel } from "@/components/common/forms/TextAreaWithLabel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { appToast } from "@/lib/toast";
import { cancelMaintenance, type MaintenanceRecord } from "@/services/maintenance";
import { cancelMaintenanceSchema, type CancelMaintenanceFormValues } from "@/validations/maintenance/schemas";
import { applyMaintenanceServerErrors, cancelMaintenanceDefaults } from "../form-support";

export function CancelMaintenanceDialog({
  record,
  onOpenChange,
  onSaved,
}: {
  record: MaintenanceRecord | null;
  onOpenChange: () => void;
  onSaved: () => void;
}) {
  const form = useForm<CancelMaintenanceFormValues>({
    resolver: zodResolver(cancelMaintenanceSchema),
    defaultValues: cancelMaintenanceDefaults,
  });
  useEffect(() => { if (record) form.reset(cancelMaintenanceDefaults); }, [form, record]);
  const close = () => { if (!form.formState.isSubmitting) onOpenChange(); };
  const save = async (values: CancelMaintenanceFormValues) => {
    if (!record) return;
    try {
      await cancelMaintenance(record.id, values);
      appToast.success("Maintenance cancelled successfully. Its future dates were released.");
      onOpenChange();
      onSaved();
    } catch (error) {
      const hasFieldErrors = applyMaintenanceServerErrors(error, form.setError, { reason: "reason" });
      appToast.error(hasFieldErrors ? "Check the cancellation reason." : "Maintenance could not be cancelled. Please try again.");
    }
  };

  return (
    <AlertDialog open={Boolean(record)} onOpenChange={(open) => { if (!open) close(); }}>
      <AlertDialogContent className="max-w-[460px] rounded-2xl border-0 shadow-[0_24px_64px_rgba(0,0,0,0.13)]">
        <form onSubmit={form.handleSubmit(save, () => appToast.error("Check the cancellation reason."))} noValidate>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Maintenance?</AlertDialogTitle>
            <AlertDialogDescription>
              Cancel “{record?.title}”? The schedule remains in History and its future booking block is released.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <TextAreaWithLabel id="maintenance-cancel-reason" label="Cancellation Reason (Optional)" error={form.formState.errors.reason?.message} {...form.register("reason")} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={form.formState.isSubmitting}>Keep Schedule</AlertDialogCancel>
            <AlertDialogAction type="submit" variant="destructive" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Cancelling..." : "Cancel Maintenance"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
