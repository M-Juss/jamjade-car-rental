"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { SelectWithLabel } from "@/components/common/forms/SelectWithLabel";
import { TextAreaWithLabel } from "@/components/common/forms/TextAreaWithLabel";
import { BookingDialogFooter } from "@/modules/management/bookings/components/BookingDialogFooter";
import { recordBookingNoShow, cancelBooking, type BookingRecord } from "@/services/booking";
import { ApiError } from "@/services/http";
import { resolveMissedStartSchema, type ResolveMissedStartValues } from "@/validations/booking/late-return";
import { NoShowConfirmation } from "./NoShowConfirmation";
import { appToast } from "@/lib/toast";

export function ResolveMissedStartForm({ booking, onCancel, onSaved, onBusyChange }: { booking: BookingRecord; onCancel: () => void; onSaved: (booking: BookingRecord) => void; onBusyChange: (busy: boolean) => void }) {
  const form = useForm<ResolveMissedStartValues>({ resolver: zodResolver(resolveMissedStartSchema), defaultValues: { reason: "", resolution: "no_show" } });
  const [confirmation, setConfirmation] = useState<ResolveMissedStartValues | null>(null);
  const resolution = useWatch({ control: form.control, name: "resolution" });
  const busy = form.formState.isSubmitting;
  useEffect(() => { onBusyChange(busy || confirmation !== null); return () => onBusyChange(false); }, [busy, confirmation, onBusyChange]);
  const submit = async (values: ResolveMissedStartValues) => {
    try { const record = await (values.resolution === "no_show" ? recordBookingNoShow(booking, values.reason, true) : cancelBooking(booking, values.reason)); appToast.success("Missed-start resolution saved."); onSaved(record); }
    catch (error) {
      setConfirmation(null);
      const fields = error instanceof ApiError ? error.errors : undefined;
      if (fields?.reason?.[0]) form.setError("reason", { message: fields.reason[0] });
      form.setError("root", { message: Object.values(fields ?? {}).flat()[0] ?? "The booking could not be resolved. Refresh and try again." });
      appToast.error("The booking could not be resolved.");
    }
  };
  return <><form noValidate className="flex min-h-0 flex-auto flex-col overflow-hidden" onSubmit={form.handleSubmit((values) => values.resolution === "no_show" ? setConfirmation(values) : submit(values), () => appToast.error("Enter the resolution reason."))}>
    <div className="min-h-0 flex-auto overflow-y-auto overscroll-contain"><div className="space-y-4 p-4 sm:p-6">
      <p id="missed-start-confirmation" className="text-xs leading-5 text-muted-foreground">Check the customer and release records before ending {booking.bookingCode}. Use cancellation when a cancellation was arranged or Jamjade could not provide handover.</p>
      <SelectWithLabel id="missed-start-resolution" label="Resolution" value={resolution} onValueChange={(value) => form.setValue("resolution", value === "no_show" ? "no_show" : "cancel")} options={[{ value: "no_show", label: "No-show", disabled: !booking.canRecordNoShow }, { value: "cancel", label: "Cancellation" }]} disabled={busy} error={form.formState.errors.resolution?.message} />
      <TextAreaWithLabel id="missed-start-reason" label="Resolution reason" required rows={4} disabled={busy} error={form.formState.errors.reason?.message} {...form.register("reason")} />
      {form.formState.errors.root?.message ? <p role="alert" className="text-xs text-destructive">{form.formState.errors.root.message}</p> : null}
    </div></div>
    <BookingDialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Back to Booking</Button><Button type="submit" variant="destructive" disabled={busy || (resolution === "no_show" && !booking.canRecordNoShow)}>{busy ? "Saving..." : "Continue"}</Button></BookingDialogFooter>
  </form><NoShowConfirmation bookingCode={booking.bookingCode} open={confirmation !== null} busy={busy}
    onBack={() => setConfirmation(null)} onConfirm={() => { if (confirmation) void form.handleSubmit(() => submit(confirmation))(); }} /></>;
}
