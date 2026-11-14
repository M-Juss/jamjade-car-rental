"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { XCircle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormDialogContent, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import { TextAreaWithLabel } from "@/components/common/forms/TextAreaWithLabel";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { SelectWithLabel } from "@/components/common/forms/SelectWithLabel";
import { useManagementSession } from "@/modules/management/shell/context/ManagementSessionProvider";
import { getUserRoleNames } from "@/services/auth";
import { BookingDialogFooter } from "@/modules/management/bookings/components/BookingDialogFooter";
import { cancelBooking, type BookingRecord } from "@/services/booking";
import { ApiError, OwnerVerificationCancelled } from "@/services/http";
import { appToast } from "@/lib/toast";
import { cancellationWithRefundSchema, type CancellationWithRefundValues } from "@/validations/booking/cancellation";

export function CancelBookingDialog({ booking, onClose, onSaved }: { booking: BookingRecord; onClose: () => void; onSaved: (booking: BookingRecord) => void }) {
  const { user } = useManagementSession();
  const paid = booking.customerPaidAmount ?? 0;
  const refundEnabled = booking.statusKey === 'confirmed' && paid > 0 && Boolean(user && getUserRoleNames(user).includes('admin'));
  const form = useForm<CancellationWithRefundValues>({ resolver: zodResolver(cancellationWithRefundSchema(paid, refundEnabled)), defaultValues: { reason: "", refundMode: 'full', refundAmount: '' } });
  const mode = useWatch({ control: form.control, name: 'refundMode' });
  const busy = form.formState.isSubmitting;
  const close = () => { if (!busy) onClose(); };
  const submit = async (values: CancellationWithRefundValues) => {
    try { const saved = await cancelBooking(booking, values.reason, refundEnabled ? { mode: values.refundMode, amount: values.refundAmount } : undefined); appToast.success(refundEnabled ? "Booking cancelled and refund approved." : "Booking cancelled."); onSaved(saved); }
    catch (error) {
      if (error instanceof OwnerVerificationCancelled) return;
      const fields = error instanceof ApiError ? error.errors : undefined;
      if (fields?.reason?.[0]) form.setError("reason", { message: fields.reason[0] });
      if (fields?.refund_amount?.[0]) form.setError("refundAmount", { message: fields.refund_amount[0] });
      if (fields?.refund_mode?.[0]) form.setError("refundMode", { message: fields.refund_mode[0] });
      form.setError("root", { message: Object.values(fields ?? {}).flat()[0] ?? "The booking could not be cancelled." });
      appToast.error("The booking could not be cancelled.");
    }
  };
  return <Dialog open onOpenChange={(open) => { if (!open) close(); }}><FormDialogContent>
    <FormDialogHeader title={`Cancel ${booking.bookingCode} and release its reserved dates.`} icon={XCircle} onClose={close} closeLabel="Close cancellation" closeDisabled={busy} />
    <form noValidate className="flex min-h-0 flex-auto flex-col overflow-hidden" onSubmit={form.handleSubmit(submit)}>
      <div className="min-h-0 flex-auto overflow-y-auto overscroll-contain"><div className="space-y-4 p-4 sm:p-6">
        {refundEnabled && <>
          <SelectWithLabel id="booking-cancel-refund" label="Refund" required value={mode} onValueChange={value => { form.setValue('refundMode', value as 'full' | 'custom', { shouldDirty: true }); form.clearErrors('refundAmount'); }} disabled={busy} error={form.formState.errors.refundMode?.message} options={[{ value: 'full', label: 'Full refund' }, { value: 'custom', label: 'Custom' }]} />
          <Controller control={form.control} name="refundAmount" render={({ field, fieldState }) => (
            <InputWithLabel {...field} id="booking-cancel-refund-amount" label="Refund amount (PHP)" inputFormat="decimal"
              value={mode === 'full' ? paid.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : field.value ?? ''}
              required={mode === 'custom'} disabled={busy || mode === 'full'} error={mode === 'custom' ? fieldState.error?.message : undefined} />
          )} />
          {mode === 'custom' && <p className="text-xs text-muted-foreground">Amount paid: PHP {paid.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
        </>}
        <TextAreaWithLabel id="booking-cancel-reason" label="Cancellation reason" required maxLength={1000} rows={4} disabled={busy} error={form.formState.errors.reason?.message} {...form.register("reason")} />
        {form.formState.errors.root?.message ? <p role="alert" className="text-xs text-destructive">{form.formState.errors.root.message}</p> : null}
      </div></div>
      <BookingDialogFooter><Button type="button" variant="outline" disabled={busy} onClick={close}>Keep Booking</Button><Button type="submit" variant="destructive" disabled={busy}>{busy ? "Cancelling..." : "Cancel Booking"}</Button></BookingDialogFooter>
    </form>
  </FormDialogContent></Dialog>;
}
