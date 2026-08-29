"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { ClipboardCheck, PenLine } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FormDialogContent, FormDialogFooter, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import { VehicleConditionForm, SignaturePad } from "@/modules/management/vehicles/inspection";
import { createVehicleConditionDefaults, type VehicleConditionFormValues } from "@/validations/vehicle/schemas";
import { bookingInspectionSchema, type BookingInspectionFormValues } from "@/validations/booking/schemas";
import { finalizeBookingInspection, type BookingRecord, type VehicleInspectionRecord } from "@/services/booking";
import { appToast } from "@/lib/toast";

function valuesFromBaseline(baseline?: VehicleInspectionRecord | null): VehicleConditionFormValues {
  const empty = createVehicleConditionDefaults();
  if (!baseline) return empty;
  const checklist = Object.fromEntries(Object.entries(empty.checklist).map(([category, items]) => [
    category,
    Object.fromEntries(Object.keys(items).map((key) => [key,
      baseline.checklist?.[category as keyof typeof empty.checklist]?.find((item) => item.key === key)?.value ?? false,
    ])),
  ])) as VehicleConditionFormValues["checklist"];
  return {
    odometer: String(baseline.odometer), fuel_level: baseline.fuelLevel, comments: baseline.comments ?? "", checklist,
    markers: (baseline.markers ?? []).map((marker) => ({ ...marker })), signature_data: "",
  };
}

export function BookingInspectionDialog({ open, onOpenChange, booking, type, personnelName, onSaved }: {
  open: boolean; onOpenChange: (open: boolean) => void; booking: BookingRecord;
  type: "outgoing" | "incoming"; personnelName?: string; onSaved: (booking: BookingRecord) => void;
}) {
  const defaults = { condition: valuesFromBaseline(booking.inspectionBaseline), operator_signature_data: "" };
  const { control, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<BookingInspectionFormValues>({
    resolver: zodResolver(bookingInspectionSchema), defaultValues: defaults,
  });
  const values = useWatch({ control }) as BookingInspectionFormValues;
  useEffect(() => { if (open) reset(defaults); }, [open, booking.inspectionBaseline?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const operatorLabel = booking.driverOption === "self_drive" ? "Renter" : "Assigned Driver";
  const submit = async (formValues: BookingInspectionFormValues) => {
    try {
      const updated = await finalizeBookingInspection(booking, type, formValues.condition, formValues.operator_signature_data);
      appToast.success(`${type === "outgoing" ? "Outgoing" : "Incoming"} Inspection finalized successfully.`);
      onSaved(updated); onOpenChange(false);
    } catch { appToast.error(`The ${type} inspection could not be finalized. Check the required fields and readiness state.`); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <FormDialogContent width="wide" className="h-[92dvh] max-h-[900px]">
      <FormDialogHeader title={`${type === "outgoing" ? "Outgoing" : "Incoming"} Inspection`} icon={ClipboardCheck} onClose={() => onOpenChange(false)} closeLabel="Close inspection" />
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit(submit, () => appToast.error("Complete both signatures and every required inspection field."))}>
        <ScrollArea className="min-h-0 flex-1"><div className="grid gap-5 p-4 sm:p-6">
          <VehicleConditionForm value={values.condition} errors={errors.condition} personnelName={personnelName} disabled={isSubmitting}
            inspectionPurpose={type} onChange={(condition) => setValue("condition", condition, { shouldDirty: true })} />
          <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-muted text-primary"><PenLine size={17} /></span>
              <div><h2 className="text-sm font-bold text-foreground">{operatorLabel} Signature</h2><p className="text-xs text-muted-foreground">{operatorLabel} signs on this Jamjade personnel device after reviewing the inspection.</p></div></div>
            <SignaturePad value={values.operator_signature_data} disabled={isSubmitting} onChange={(value) => setValue("operator_signature_data", value, { shouldDirty: true })} />
            {errors.operator_signature_data?.message ? <p className="mt-2 text-xs font-medium text-destructive">{errors.operator_signature_data.message}</p> : null}
          </section>
        </div></ScrollArea>
        <FormDialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Finalizing..." : `Finalize ${type === "outgoing" ? "Outgoing" : "Incoming"}`}</Button></FormDialogFooter>
      </form>
    </FormDialogContent>
  </Dialog>;
}
