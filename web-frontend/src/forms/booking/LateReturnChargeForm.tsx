"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { TextAreaWithLabel } from "@/components/common/forms/TextAreaWithLabel";
import { SelectWithLabel } from "@/components/common/forms/SelectWithLabel";
import { BookingDialogFooter } from "@/modules/management/bookings/components/BookingDialogFooter";
import { LateReturnSummary } from "@/modules/management/bookings/components/LateReturnSummary";
import { ApiError, OwnerVerificationCancelled } from "@/services/http";
import { reviewLateCharge, type BookingRecord } from "@/services/booking";
import { createLateChargeSchema, type LateChargeValues } from "@/validations/booking/late-return";
import { appToast } from "@/lib/toast";

export function LateReturnChargeForm({ booking, onCancel, onSaved, onBusyChange, previousDisabled = false }: { booking: BookingRecord; onCancel: () => void; onSaved: () => Promise<void>; onBusyChange: (busy: boolean) => void; previousDisabled?: boolean }) {
  const estimate = booking.lateReturn?.estimatedAmount ?? null;
  const existingCharges = (booking.additionalCharges ?? []).filter((charge) => charge.type === "late_return");
  const initialAmount = existingCharges.length ? existingCharges.reduce((sum, charge) => sum + charge.amount, 0) : estimate;
  const form = useForm<LateChargeValues>({ resolver: zodResolver(createLateChargeSchema(estimate, booking.driverOption === "self_drive", booking.lateReturn?.billableHours ?? 0)), defaultValues: { amount: initialAmount === null ? "" : String(initialAmount), adjustment_reason: "", responsibility: "customer" } });
  const responsibility = useWatch({ control: form.control, name: "responsibility" });
  const busy = form.formState.isSubmitting;
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  const submit = async (values: LateChargeValues) => {
    try { await reviewLateCharge(booking, { ...values, amount: Number(values.amount) }); appToast.success("Late return charge reviewed."); await onSaved(); }
    catch (error) {
      if (error instanceof OwnerVerificationCancelled) return;
      form.setError("root", { message: "The charge could not be reviewed. Refresh the booking and try again." });
      if (error instanceof ApiError) for (const [key, messages] of Object.entries(error.errors ?? {})) {
        form.setError(key === "amount" || key === "adjustment_reason" || key === "responsibility" ? key : "root", { message: messages[0] });
      }
      appToast.error("Late return charge could not be reviewed.");
    }
  };
  return <form noValidate className="flex min-h-0 flex-auto flex-col overflow-hidden" onSubmit={form.handleSubmit(submit, () => appToast.error("Check the late charge amount and adjustment reason."))}>
    <div data-workflow-body className="min-h-0 flex-auto overflow-y-auto overscroll-contain"><div className="space-y-3 p-4 sm:p-5">
      <h2 data-workflow-heading tabIndex={-1} className="text-sm font-semibold text-foreground">Review Late Return Charge</h2>
      <LateReturnSummary booking={booking} />
      <p className="text-xs leading-5 text-muted-foreground">Approve the calculated charge or enter an adjustment. Enter zero to waive it. A waiver, changed amount, or legacy rate requires a reason. Saving records this review once.</p>
      {existingCharges.length ? <p className="text-xs text-warning">A late charge is already recorded. Review its total; this action preserves the existing charge and payment history.</p> : null}
      <InputWithLabel id="late-charge-amount" label="Approved amount (PHP)" required type="number" min="0" max="9999999.99" step="0.01" disabled={busy} error={form.formState.errors.amount?.message} {...form.register("amount")} />
      <TextAreaWithLabel id="late-charge-reason" label="Adjustment / legacy terms reason" rows={3} maxLength={1000} disabled={busy} error={form.formState.errors.adjustment_reason?.message} {...form.register("adjustment_reason")} />
      {booking.driverOption === "owners_driver" ? <SelectWithLabel id="late-charge-responsibility" label="Responsibility" required options={[{ value: "customer", label: "Customer / Renter" }, { value: "driver", label: "Assigned Driver" }]} value={responsibility} disabled={busy} error={form.formState.errors.responsibility?.message} onValueChange={(value) => form.setValue("responsibility", value as "customer" | "driver", { shouldDirty: true })} /> : null}
      {form.formState.errors.root?.message ? <p role="alert" className="text-xs text-destructive">{form.formState.errors.root.message}</p> : null}
    </div></div>
    <BookingDialogFooter><Button type="button" variant="outline" disabled={busy || previousDisabled} onClick={onCancel}>Previous</Button><Button type="submit" disabled={busy}>{busy ? "Saving..." : "Approve Review & Continue"}</Button></BookingDialogFooter>
  </form>;
}
