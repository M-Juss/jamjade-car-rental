"use client";

import { useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type FieldErrors, type Path } from "react-hook-form";
import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingDialogFooter } from "@/modules/management/bookings/components/BookingDialogFooter";
import { VehicleConditionForm, SignaturePad } from "@/modules/management/vehicles/inspection";
import { createVehicleConditionDefaults, type VehicleConditionFormValues } from "@/validations/vehicle/schemas";
import { bookingInspectionSchema, type BookingInspectionFormValues } from "@/validations/booking/schemas";
import { finalizeBookingInspection, type BookingRecord, type VehicleInspectionRecord } from "@/services/booking";
import { appToast } from "@/lib/toast";
import { ApiError } from "@/services/http";

function valuesFromBaseline(baseline?: VehicleInspectionRecord | null): VehicleConditionFormValues {
  const empty = createVehicleConditionDefaults();
  if (!baseline) return empty;
  const checklist = Object.fromEntries(Object.keys(empty.checklist).map((category) => [
    category, Object.fromEntries((baseline.checklist?.[category as keyof typeof empty.checklist] ?? []).map((item) => [item.key, item.value])),
  ])) as VehicleConditionFormValues["checklist"];
  return {
    checklist_definition: Object.fromEntries(Object.keys(empty.checklist).map((category) => [
      category, Object.fromEntries((baseline.checklist?.[category as keyof typeof empty.checklist] ?? []).map((item) => [item.key, item.label])),
    ])) as VehicleConditionFormValues["checklist_definition"], checklist_version: "", odometer: String(baseline.odometer), fuel_level: baseline.fuelLevel, comments: baseline.comments ?? "", checklist,
    markers: (baseline.markers ?? []).map((marker) => ({ ...marker })), signature_data: "",
  };
}

function inspectionErrorSection(field: string) {
  if (field.startsWith("condition.odometer") || field.startsWith("condition.fuel_level")) return "condition-mileage-fuel";
  if (field.startsWith("condition.checklist")) return "condition-checklist";
  if (field.startsWith("condition.markers")) return "condition-body";
  if (field === "condition.comments") return "condition-comments-section";
  return field === "operator_signature_data" ? "operator-signature" : "condition-signature";
}

export function BookingInspectionForm({ onClose, booking, type, personnelName, onSaved, onBusyChange, previousDisabled = false }: {
  onClose: () => void; booking: BookingRecord;
  type: "outgoing" | "incoming"; personnelName?: string; onSaved: () => Promise<void>; onBusyChange: (busy: boolean) => void;
  previousDisabled?: boolean;
}) {
  const defaults = { condition: valuesFromBaseline(booking.inspectionBaseline), operator_signature_data: "" };
  const { control, handleSubmit, setError, setValue, formState: { errors, isSubmitting } } = useForm<BookingInspectionFormValues>({
    resolver: zodResolver(bookingInspectionSchema), defaultValues: defaults,
  });
  const values = useWatch({ control }) as BookingInspectionFormValues;
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { onBusyChange(isSubmitting); return () => onBusyChange(false); }, [isSubmitting, onBusyChange]);

  const jumpTo = (id: string) => {
    const body = formRef.current?.querySelector<HTMLElement>("[data-workflow-body]");
    const target = formRef.current?.querySelector<HTMLElement>(`#${id}`);
    if (!body || !target) return;
    body.scrollTop += target.getBoundingClientRect().top - body.getBoundingClientRect().top - 16;
    target.focus({ preventScroll: true });
  };
  const invalid = (invalidFields: FieldErrors<BookingInspectionFormValues>) => {
    const condition = invalidFields.condition;
    const section = condition?.odometer || condition?.fuel_level ? "condition-mileage-fuel"
      : condition?.checklist ? "condition-checklist" : condition?.markers ? "condition-body"
        : condition?.comments ? "condition-comments-section" : condition?.signature_data ? "condition-signature" : "operator-signature";
    jumpTo(section);
    appToast.error("Check the highlighted inspection fields and both signatures.");
  };

  const operatorLabel = booking.driverOption === "self_drive" ? "Renter" : "Assigned Driver";
  const startsHandover = type === "outgoing" && booking.driverOption === "self_drive";
  const submitLabel = startsHandover ? "Finalize Inspection & Start Handover" : "Finalize Inspection";
  const submit = async (formValues: BookingInspectionFormValues) => {
    try {
      await finalizeBookingInspection(booking, type, formValues.condition, formValues.operator_signature_data);
      appToast.success(startsHandover ? "Outgoing Inspection finalized and handover started." : `${type === "outgoing" ? "Outgoing" : "Incoming"} Inspection finalized successfully.`);
      await onSaved();
    } catch (error) {
      const bookingError = error instanceof ApiError ? error.errors?.booking?.[0] ?? error.errors?.telematics_setup?.[0] : undefined;
      const body = formRef.current?.querySelector<HTMLElement>("[data-workflow-body]");
      if (body) body.scrollTop = 0;
      if (error instanceof ApiError && error.errors) {
        Object.entries(error.errors).forEach(([field, messages]) => {
          if (!messages[0]) return;
          const clientField = field.replace(/\.sequence_number/g, ".sequenceNumber").replace(/\.x_position/g, ".xPosition")
            .replace(/\.y_position/g, ".yPosition").replace(/\.issue_type/g, ".issueType");
          if (["condition.odometer", "condition.fuel_level", "condition.comments", "condition.signature_data", "operator_signature_data"].includes(clientField)) {
            setError(clientField as Path<BookingInspectionFormValues>, { type: "server", message: messages[0] });
          } else if (clientField === "condition.markers" || clientField.startsWith("condition.markers.")) {
            setError("condition.markers", { type: "server", message: messages[0] });
          } else if (clientField === "condition.checklist_version" || clientField === "condition.checklist" || clientField.startsWith("condition.checklist.")) {
            setError("condition.checklist", { type: "server", message: messages[0] });
          } else setError("root", { type: "server", message: "The inspection could not be finalized. Check the booking requirements and try again." });
        });
        const firstField = Object.keys(error.errors).find((field) => error.errors?.[field]?.[0]);
        if (firstField?.startsWith("condition.") || firstField === "operator_signature_data") jumpTo(inspectionErrorSection(firstField));
      } else setError("root", { type: "server", message: "The inspection could not be finalized. Please try again." });
      if (bookingError) setError("root", { type: "server", message: bookingError });
      appToast.error(bookingError ?? `The ${type} inspection could not be finalized. Check the required fields and readiness state.`);
    }
  };

  return <form ref={formRef} noValidate className="flex min-h-0 flex-auto flex-col overflow-hidden" onSubmit={(event) => void handleSubmit(submit, invalid)(event)}>
        <div data-workflow-body className="min-h-0 min-w-0 flex-auto overflow-y-auto overscroll-contain"><div className="grid gap-3 p-4 sm:p-5">
          <h2 data-workflow-heading tabIndex={-1} className="sr-only">{type === "incoming" ? "Incoming Inspection" : "Outgoing Inspection"}</h2>
          <p className="text-xs leading-5 text-muted-foreground">Review the {type === "incoming" ? "outgoing inspection" : "current vehicle condition"}, update the readings and issues, then collect both signatures. Finalizing saves an immutable inspection.</p>
          {errors.root?.message ? <p role="alert" className="text-xs text-destructive">{errors.root.message}</p> : null}
          <VehicleConditionForm value={values.condition} errors={errors.condition} personnelName={personnelName} disabled={isSubmitting}
            inspectionPurpose={type} onChange={(condition) => setValue("condition", condition, { shouldDirty: true })}
            operatorSignature={<section id="operator-signature" tabIndex={-1} className="min-w-0 scroll-mt-4 rounded-2xl border border-border bg-surface p-4 outline-none">
            <div className="mb-2 flex items-start gap-3"><span className="flex shrink-0 items-center justify-center text-primary"><PenLine size={17} /></span>
              <h2 className="text-sm font-semibold text-foreground">{operatorLabel} Signature</h2></div>
            <SignaturePad value={values.operator_signature_data} disabled={isSubmitting} onChange={(value) => setValue("operator_signature_data", value, { shouldDirty: true })} />
            {errors.operator_signature_data?.message ? <p className="mt-2 text-xs font-medium text-destructive">{errors.operator_signature_data.message}</p> : null}
          </section>} />
        </div></div>
        <BookingDialogFooter><Button type="button" variant="outline" disabled={isSubmitting || previousDisabled} onClick={onClose}>Previous</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Finalizing..." : submitLabel}</Button></BookingDialogFooter>
      </form>;
}
