"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { TextAreaWithLabel } from "@/components/common/forms/TextAreaWithLabel";
import { BookingDialogFooter } from "@/modules/management/bookings/components/BookingDialogFooter";
import { ApiError } from "@/services/http";
import { saveReturnFollowUp, type BookingRecord } from "@/services/booking";
import { fromManilaInput, manilaTimeInput } from "@/services/booking/return-time";
import { returnFollowUpSchema, type ReturnFollowUpValues } from "@/validations/booking/late-return";
import { appToast } from "@/lib/toast";

export function ReturnFollowUpForm({ booking, onCancel, onSaved, onBusyChange }: { booking: BookingRecord; onCancel: () => void; onSaved: (booking: BookingRecord) => void; onBusyChange: (busy: boolean) => void }) {
  const form = useForm<ReturnFollowUpValues>({ resolver: zodResolver(returnFollowUpSchema), defaultValues: { note: "", expected_return_at: booking.lateReturn?.expectedReturnAt ? manilaTimeInput(new Date(booking.lateReturn.expectedReturnAt)) : "" } });
  const busy = form.formState.isSubmitting;
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  const submit = async (values: ReturnFollowUpValues) => {
    try { const record = await saveReturnFollowUp(booking, values.note, values.expected_return_at ? fromManilaInput(values.expected_return_at) : null); appToast.success("Return follow-up saved."); onSaved(record); }
    catch (error) {
      form.setError("root", { message: "Follow-up could not be saved. Refresh and try again." });
      if (error instanceof ApiError) for (const [key, messages] of Object.entries(error.errors ?? {})) form.setError(key === "note" || key === "expected_return_at" ? key : "root", { message: messages[0] });
    }
  };
  return <form noValidate className="flex min-h-0 flex-auto flex-col overflow-hidden" onSubmit={form.handleSubmit(submit)}>
    <div data-workflow-body className="min-h-0 flex-auto overflow-y-auto overscroll-contain"><div className="space-y-4 p-4 sm:p-6">
      <p className="text-xs leading-5 text-muted-foreground">Record the contact outcome. An expected return time does not extend the booking or change its late-charge deadline.</p>
      <TextAreaWithLabel id="return-contact-note" label="Contact outcome" required rows={4} maxLength={1000} disabled={busy} error={form.formState.errors.note?.message} {...form.register("note")} />
      <InputWithLabel id="expected-return-at" label="Expected return (optional)" type="datetime-local" step="1" disabled={busy} error={form.formState.errors.expected_return_at?.message} {...form.register("expected_return_at")} />
      {form.formState.errors.root?.message ? <p role="alert" className="text-xs text-destructive">{form.formState.errors.root.message}</p> : null}
    </div></div>
    <BookingDialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Back to Booking</Button><Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save Follow-up"}</Button></BookingDialogFooter>
  </form>;
}
