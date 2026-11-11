"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { TextAreaWithLabel } from "@/components/common/forms/TextAreaWithLabel";
import { BookingDialogFooter } from "@/modules/management/bookings/components/BookingDialogFooter";
import { reviewCancellationRefund, recordCancellationRefund, type BookingRecord } from "@/services/booking";
import { ApiError, OwnerVerificationCancelled } from "@/services/http";
import { appToast } from "@/lib/toast";
import { cancellationRefundSchema, recordCancellationRefundSchema, type CancellationRefundValues, type RecordCancellationRefundValues } from "@/validations/booking/cancellation";

type Props = { booking: BookingRecord; onCancel: () => void; onSaved: (booking: BookingRecord) => void; onBusyChange: (busy: boolean) => void };

export function CancellationRefundForm({ booking, onCancel, onSaved, onBusyChange }: Props) {
  const form = useForm<CancellationRefundValues>({ resolver: zodResolver(cancellationRefundSchema), defaultValues: { amount: "", reason: "" } });
  const busy = form.formState.isSubmitting;
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  const submit = async (values: CancellationRefundValues) => {
    try {
      const record = await reviewCancellationRefund(booking, values);
      appToast.success("Refund decision saved."); onSaved(record);
    } catch (error) {
      if (error instanceof OwnerVerificationCancelled) return;
      const fields = error instanceof ApiError ? error.errors : undefined;
      form.setError("root", { message: "The refund decision could not be saved." });
      for (const [key, messages] of Object.entries(fields ?? {})) form.setError(key === "amount" || key === "reason" ? key : "root", { message: messages[0] });
      appToast.error("The refund decision could not be saved.");
    }
  };
  return <form noValidate className="flex min-h-0 flex-auto flex-col overflow-hidden" onSubmit={form.handleSubmit(submit)}>
    <div className="min-h-0 flex-auto overflow-y-auto overscroll-contain"><div className="space-y-4 p-4 sm:p-6">
      <p className="text-xs text-muted-foreground">Enter the approved refund, or 0 to decline. Saving this decision does not return money.</p>
      <InputWithLabel id="cancellation-refund-amount" label="Approved refund (PHP)" inputFormat="decimal" required disabled={busy} error={form.formState.errors.amount?.message} {...form.register("amount")} />
      <TextAreaWithLabel id="cancellation-refund-reason" label="Decision reason" rows={4} maxLength={1000} required disabled={busy} error={form.formState.errors.reason?.message} {...form.register("reason")} />
      {form.formState.errors.root?.message ? <p role="alert" className="text-xs text-destructive">{form.formState.errors.root.message}</p> : null}
    </div></div>
    <BookingDialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Back to Booking</Button><Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save Refund Decision"}</Button></BookingDialogFooter>
  </form>;
}

export function RecordCancellationRefundForm({ booking, onCancel, onSaved, onBusyChange }: Props) {
  const form = useForm<RecordCancellationRefundValues>({ resolver: zodResolver(recordCancellationRefundSchema), defaultValues: { confirmed: false } });
  const confirmed = useWatch({ control: form.control, name: "confirmed" });
  const busy = form.formState.isSubmitting;
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  const submit = async (values: RecordCancellationRefundValues) => {
    try {
      const record = await recordCancellationRefund(booking, values.confirmed);
      appToast.success("External refund recorded."); onSaved(record);
    } catch (error) {
      if (error instanceof OwnerVerificationCancelled) return;
      form.setError("root", { message: error instanceof ApiError ? Object.values(error.errors ?? {}).flat()[0] ?? "The refund could not be recorded." : "The refund could not be recorded." });
      appToast.error("The refund could not be recorded.");
    }
  };
  return <form noValidate className="flex min-h-0 flex-auto flex-col overflow-hidden" onSubmit={form.handleSubmit(submit)}>
    <div className="min-h-0 flex-auto overflow-y-auto overscroll-contain"><div className="space-y-4 p-4 sm:p-6">
      <p className="text-sm font-semibold">Approved refund: PHP {Number(booking.cancellation?.refundAmount ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
      <label className="flex items-start gap-3 text-xs" htmlFor="refund-returned"><Checkbox id="refund-returned" disabled={busy} checked={confirmed} onCheckedChange={(checked) => form.setValue("confirmed", checked === true, { shouldValidate: true })} /><span>I confirm this amount has already been returned to the customer outside the app.</span></label>
      {form.formState.errors.confirmed?.message ? <p role="alert" className="text-xs text-destructive">{form.formState.errors.confirmed.message}</p> : null}
      {form.formState.errors.root?.message ? <p role="alert" className="text-xs text-destructive">{form.formState.errors.root.message}</p> : null}
    </div></div>
    <BookingDialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Back to Booking</Button><Button type="submit" disabled={busy}>{busy ? "Saving..." : "Record Money Returned"}</Button></BookingDialogFooter>
  </form>;
}
