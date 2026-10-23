"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { BookingDialogFooter } from "@/modules/management/bookings/components/BookingDialogFooter";
import { LateChargeSummary } from "@/modules/management/bookings/components/LateReturnSummary";
import { ApiError } from "@/services/http";
import { receiveVehicle, type BookingRecord } from "@/services/booking";
import { formatReturnDateTime, fromManilaInput, manilaTimeInput } from "@/services/booking/return-time";
import { receiveVehicleSchema, type ReceiveVehicleValues } from "@/validations/booking/late-return";
import { appToast } from "@/lib/toast";

export function ReceiveVehicleForm({ booking, onCancel, onSaved, onBusyChange, previousDisabled = false }: { booking: BookingRecord; onCancel: () => void; onSaved: () => Promise<void>; onBusyChange: (busy: boolean) => void; previousDisabled?: boolean }) {
  const form = useForm<ReceiveVehicleValues>({ resolver: zodResolver(receiveVehicleSchema), defaultValues: { vehicle_received_at: manilaTimeInput() } });
  const [editingReceivedTime, setEditingReceivedTime] = useState(false);
  const busy = form.formState.isSubmitting;
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  const submit = async (values: ReceiveVehicleValues) => {
    try { await receiveVehicle(booking, fromManilaInput(values.vehicle_received_at)); appToast.success("Vehicle marked as received."); await onSaved(); }
    catch (error) {
      const message = error instanceof ApiError ? error.errors?.vehicle_received_at?.[0] : undefined;
      form.setError(message ? "vehicle_received_at" : "root", { message: message ?? "The received time could not be saved. Refresh the booking and try again." });
      appToast.error("The vehicle could not be marked as received.");
    }
  };
  return <form noValidate className="flex min-h-0 flex-auto flex-col overflow-hidden" onSubmit={form.handleSubmit(submit, () => appToast.error("Check the received time."))}>
    <div data-workflow-body className="min-h-0 flex-auto overflow-y-auto overscroll-contain"><div className="space-y-3 p-4 sm:p-5">
      <h2 data-workflow-heading tabIndex={-1} className="sr-only">Record Vehicle Received</h2>
      <dl className="text-xs">
        <dt className="text-muted-foreground">Scheduled return</dt>
        <dd className="mt-1 font-semibold text-foreground">{formatReturnDateTime(booking.rentalEndAt)}</dd>
      </dl>
      <Controller control={form.control} name="vehicle_received_at" render={({ field, fieldState }) => (
        <InputWithLabel
          {...field}
          id="vehicle-received-at"
          label="Date and time received"
          type={editingReceivedTime ? "datetime-local" : "text"}
          step="1"
          required
          disabled={busy}
          error={fieldState.error?.message}
          value={editingReceivedTime || !field.value ? field.value : formatReturnDateTime(`${field.value}+08:00`, true)}
          onInput={(event) => { if (editingReceivedTime) field.onChange(event.currentTarget.value); }}
          onFocus={() => setEditingReceivedTime(true)}
          onBlur={() => { field.onBlur(); setEditingReceivedTime(false); }}
        />
      )} />
      {form.formState.errors.root?.message ? <p role="alert" className="text-xs text-destructive">{form.formState.errors.root.message}</p> : null}
      <LateChargeSummary booking={booking} />
    </div></div>
    <BookingDialogFooter><Button type="button" variant="outline" disabled={busy || previousDisabled} onClick={onCancel}>Previous</Button><Button type="submit" disabled={busy}>{busy ? "Saving..." : "Mark Received & Continue"}</Button></BookingDialogFooter>
  </form>;
}
