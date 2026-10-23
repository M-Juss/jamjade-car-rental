"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { SelectWithLabel } from "@/components/common/forms/SelectWithLabel";
import { TextAreaWithLabel } from "@/components/common/forms/TextAreaWithLabel";
import { BookingDialogFooter } from "@/modules/management/bookings/components/BookingDialogFooter";
import { recordBookingNoShow, cancelBooking, type BookingRecord } from "@/services/booking";
import { ApiError } from "@/services/http";
import { resolveMissedStartSchema, type ResolveMissedStartValues } from "@/validations/booking/late-return";
import { appToast } from "@/lib/toast";

export function ResolveMissedStartForm({ booking, onCancel, onSaved, onBusyChange }: { booking: BookingRecord; onCancel: () => void; onSaved: (booking: BookingRecord) => void; onBusyChange: (busy: boolean) => void }) {
  const form = useForm<ResolveMissedStartValues>({ resolver: zodResolver(resolveMissedStartSchema), defaultValues: { reason: "", resolution: "no_show" } });
  const resolution = useWatch({ control: form.control, name: "resolution" });
  const busy = form.formState.isSubmitting;
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  const submit = async (values: ResolveMissedStartValues) => {
    try { const record = await (values.resolution === "no_show" ? recordBookingNoShow(booking, values.reason) : cancelBooking(booking, values.reason)); appToast.success("Missed-start resolution saved."); onSaved(record); }
    catch (error) { form.setError("reason", { message: error instanceof ApiError ? error.errors?.reason?.[0] ?? "The booking could not be resolved. Refresh and try again." : "The booking could not be resolved. Please try again." }); }
  };
  return <form noValidate className="flex min-h-0 flex-auto flex-col overflow-hidden" onSubmit={form.handleSubmit(submit)}>
    <div className="min-h-0 flex-auto overflow-y-auto overscroll-contain"><div className="space-y-4 p-4 sm:p-6">
      <p id="missed-start-confirmation" className="text-xs leading-5 text-muted-foreground">Check the customer and release records first. Confirm cancellation of {booking.bookingCode} only if the vehicle was never released. A no-show retains all rental payments. Use cancellation when Jamjade could not provide handover or a cancellation was arranged.</p>
      <SelectWithLabel id="missed-start-resolution" label="Resolution" value={resolution} onValueChange={(value) => form.setValue("resolution", value === "no_show" ? "no_show" : "cancel")} options={[{ value: "no_show", label: "No-show — no refund" }, { value: "cancel", label: "Cancellation — owner refund review" }]} disabled={busy} error={form.formState.errors.resolution?.message} />
      <TextAreaWithLabel id="missed-start-reason" label="Resolution reason" required rows={4} maxLength={1000} disabled={busy} error={form.formState.errors.reason?.message} {...form.register("reason")} />
    </div></div>
    <BookingDialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Back to Booking</Button><Button type="submit" variant="destructive" disabled={busy}>{busy ? "Saving..." : "Save Resolution"}</Button></BookingDialogFooter>
  </form>;
}
