"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { XCircle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormDialogContent, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import { TextAreaWithLabel } from "@/components/common/forms/TextAreaWithLabel";
import { BookingDialogFooter } from "@/modules/management/bookings/components/BookingDialogFooter";
import { NoShowConfirmation } from "./NoShowConfirmation";
import { recordBookingNoShow, rejectBooking, type BookingRecord } from "@/services/booking";
import { ApiError } from "@/services/http";
import { appToast } from "@/lib/toast";
import { bookingDecisionSchema, type BookingDecisionValues } from "@/validations/booking/decision";

export function BookingDecisionDialog({ booking, action, onClose, onSaved }: {
  booking: BookingRecord; action: "reject" | "no_show"; onClose: () => void; onSaved: (booking: BookingRecord) => void;
}) {
  const noShow = action === "no_show";
  const [confirmOpen, setConfirmOpen] = useState(false);
  const form = useForm<BookingDecisionValues>({ resolver: zodResolver(bookingDecisionSchema), defaultValues: { reason: "" } });
  const busy = form.formState.isSubmitting;
  const close = () => { if (!busy && !confirmOpen) onClose(); };
  const invalid = () => appToast.error("Enter a reason of up to 1,000 characters.");
  const save = async (values: BookingDecisionValues) => {
    try {
      const saved = noShow ? await recordBookingNoShow(booking, values.reason, true) : await rejectBooking(booking, values.reason);
      appToast.success(noShow ? "No-show recorded. Payments are not refundable." : "Booking rejected.");
      onSaved(saved);
    } catch (error) {
      setConfirmOpen(false);
      const fields = error instanceof ApiError ? error.errors : undefined;
      if (fields?.reason?.[0]) form.setError("reason", { message: fields.reason[0] });
      form.setError("root", { message: Object.values(fields ?? {}).flat()[0] ?? "Refresh the booking and try again." });
      appToast.error(noShow ? "No-show could not be recorded." : "Booking could not be rejected.");
    }
  };
  return <><Dialog open onOpenChange={(next) => { if (!next) close(); }}><FormDialogContent>
    <FormDialogHeader title={noShow ? "No-show" : "Reject booking"} icon={XCircle} onClose={close} closeLabel="Close booking decision" closeDisabled={busy || confirmOpen} />
    <form noValidate className="flex min-h-0 flex-auto flex-col overflow-hidden" onSubmit={form.handleSubmit(noShow ? () => setConfirmOpen(true) : save, invalid)}>
      <div className="min-h-0 flex-auto overflow-y-auto overscroll-contain"><div className="space-y-4 p-4 sm:p-6">
        <TextAreaWithLabel id="booking-decision-reason" label="Reason" required rows={4} disabled={busy || confirmOpen} error={form.formState.errors.reason?.message} {...form.register("reason")} />
        {form.formState.errors.root?.message ? <p role="alert" className="text-xs text-destructive">{form.formState.errors.root.message}</p> : null}
      </div></div>
      <BookingDialogFooter><Button type="button" variant="outline" disabled={busy || confirmOpen} onClick={close}>Keep booking</Button><Button type="submit" variant="destructive" disabled={busy || confirmOpen || (noShow && !booking.canRecordNoShow)}>{busy ? "Saving..." : noShow ? "Continue" : "Reject"}</Button></BookingDialogFooter>
    </form>
  </FormDialogContent></Dialog>
    <NoShowConfirmation bookingCode={booking.bookingCode} open={confirmOpen} busy={busy} onBack={() => setConfirmOpen(false)} onConfirm={() => { void form.handleSubmit(save, invalid)(); }} />
  </>;
}
