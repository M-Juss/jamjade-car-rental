"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { XCircle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormDialogContent, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import { TextAreaWithLabel } from "@/components/common/forms/TextAreaWithLabel";
import { BookingDialogFooter } from "@/modules/management/bookings/components/BookingDialogFooter";
import { cancelBooking, type BookingRecord } from "@/services/booking";
import { ApiError } from "@/services/http";
import { appToast } from "@/lib/toast";
import { cancellationReasonSchema, type CancellationReasonValues } from "@/validations/booking/cancellation";

export function CancelBookingDialog({ booking, onClose, onSaved }: { booking: BookingRecord; onClose: () => void; onSaved: (booking: BookingRecord) => void }) {
  const form = useForm<CancellationReasonValues>({ resolver: zodResolver(cancellationReasonSchema), defaultValues: { reason: "" } });
  const busy = form.formState.isSubmitting;
  const close = () => { if (!busy) onClose(); };
  const submit = async (values: CancellationReasonValues) => {
    try { const saved = await cancelBooking(booking, values.reason); appToast.success("Booking cancelled. Refund review is separate."); onSaved(saved); }
    catch (error) {
      const fields = error instanceof ApiError ? error.errors : undefined;
      if (fields?.reason?.[0]) form.setError("reason", { message: fields.reason[0] });
      form.setError("root", { message: Object.values(fields ?? {}).flat()[0] ?? "The booking could not be cancelled." });
      appToast.error("The booking could not be cancelled.");
    }
  };
  return <Dialog open onOpenChange={(open) => { if (!open) close(); }}><FormDialogContent>
    <FormDialogHeader title="Cancel Booking" icon={XCircle} onClose={close} closeLabel="Close cancellation" />
    <form noValidate className="flex min-h-0 flex-auto flex-col overflow-hidden" onSubmit={form.handleSubmit(submit)}>
      <div className="min-h-0 flex-auto overflow-y-auto overscroll-contain"><div className="space-y-4 p-4 sm:p-6">
        <p className="text-xs text-muted-foreground">Cancel {booking.bookingCode} and release its reserved dates. Refunds require a separate owner decision.</p>
        <TextAreaWithLabel id="booking-cancel-reason" label="Cancellation reason" required maxLength={1000} rows={4} disabled={busy} error={form.formState.errors.reason?.message} {...form.register("reason")} />
        {form.formState.errors.root?.message ? <p role="alert" className="text-xs text-destructive">{form.formState.errors.root.message}</p> : null}
      </div></div>
      <BookingDialogFooter><Button type="button" variant="outline" disabled={busy} onClick={close}>Keep Booking</Button><Button type="submit" variant="destructive" disabled={busy}>{busy ? "Cancelling..." : "Cancel Booking"}</Button></BookingDialogFooter>
    </form>
  </FormDialogContent></Dialog>;
}
