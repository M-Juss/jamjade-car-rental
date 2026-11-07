"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Settings2 } from "lucide-react";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { appToast } from "@/lib/toast";
import { ApiError } from "@/services/http";
import { getLateReturnPricing, saveLateReturnPricing } from "@/services/booking/late-return-pricing.service";
import { getDeliveryPricing, saveDeliveryPricing } from "@/services/delivery/delivery.service";
import { feePricingSchema, type FeePricingValues } from "@/validations/pricing/schemas";

const lateFields = [["small_vehicle_hourly_rate", "5 seats or fewer (PHP/hour)"], ["large_vehicle_hourly_rate", "6 seats or more (PHP/hour)"]] as const;
const deliveryFields = [["minimum_fee", "Minimum delivery fee (PHP)"], ["included_km", "Included distance (km)"], ["per_km_rate", "Additional price per km (PHP)"]] as const;
const emptyValues: FeePricingValues = { small_vehicle_hourly_rate: "", large_vehicle_hourly_rate: "", minimum_fee: "", included_km: "", per_km_rate: "" };
type PricingField = keyof FeePricingValues;

export function FeePricingForm() {
  const form = useForm<FeePricingValues>({ resolver: zodResolver(feePricingSchema), defaultValues: emptyValues });
  const confirmed = useRef<FeePricingValues | null>(null);
  const pending = useRef(false);
  const refreshAfterFailure = useRef(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const busy = saving || form.formState.isSubmitting;

  useEffect(() => {
    let active = true;
    Promise.all([getLateReturnPricing(), getDeliveryPricing()]).then(([late, delivery]) => {
      if (!active) return;
      const values = {
        small_vehicle_hourly_rate: String(late.small_vehicle_hourly_rate),
        large_vehicle_hourly_rate: String(late.large_vehicle_hourly_rate),
        minimum_fee: String(delivery.minimum_fee), included_km: String(delivery.included_km), per_km_rate: String(delivery.per_km_rate),
      };
      confirmed.current = values;
      refreshAfterFailure.current = false;
      form.reset(values);
      setLoadError(null);
    }).catch(error => {
      if (active) setLoadError(error instanceof ApiError && error.status === 403 ? "Only administrators can configure pricing." : "Pricing could not be loaded.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [form, reload]);

  useEffect(() => { if (editing) form.setFocus("small_vehicle_hourly_rate"); }, [editing, form]);

  const cancel = () => {
    if (pending.current || !confirmed.current) return;
    form.reset(confirmed.current);
    setEditing(false);
    if (refreshAfterFailure.current) { setLoading(true); setReload(value => value + 1); }
  };

  const submit = async (values: FeePricingValues) => {
    const previous = confirmed.current;
    if (!editing || pending.current || !previous) return;
    const lateChanged = lateFields.some(([name]) => Number(values[name]) !== Number(previous[name]));
    const deliveryChanged = deliveryFields.some(([name]) => Number(values[name]) !== Number(previous[name]));
    if (!lateChanged && !deliveryChanged) {
      cancel();
      appToast.info("No pricing changes to save.");
      return;
    }
    pending.current = true;
    setSaving(true);
    try {
      const [late, delivery] = await Promise.allSettled([
        lateChanged ? saveLateReturnPricing({ small_vehicle_hourly_rate: values.small_vehicle_hourly_rate, large_vehicle_hourly_rate: values.large_vehicle_hourly_rate }) : Promise.resolve(null),
        deliveryChanged ? saveDeliveryPricing({ minimum_fee: values.minimum_fee, included_km: values.included_km, per_km_rate: values.per_km_rate }) : Promise.resolve(null),
      ]);
      const saved = { ...previous };
      if (late.status === "fulfilled" && late.value) {
        saved.small_vehicle_hourly_rate = String(late.value.small_vehicle_hourly_rate);
        saved.large_vehicle_hourly_rate = String(late.value.large_vehicle_hourly_rate);
      }
      if (delivery.status === "fulfilled" && delivery.value) {
        saved.minimum_fee = String(delivery.value.minimum_fee);
        saved.included_km = String(delivery.value.included_km);
        saved.per_km_rate = String(delivery.value.per_km_rate);
      }
      confirmed.current = saved;
      form.reset(saved);
      if (late.status === "fulfilled" && delivery.status === "fulfilled") {
        refreshAfterFailure.current = false;
        setEditing(false);
        appToast.success("Fee pricing saved.");
        return;
      }

      const restoreFailure = (result: PromiseRejectedResult, fields: readonly (readonly [PricingField, string])[]) => {
        fields.forEach(([name]) => form.setValue(name, values[name], { shouldDirty: true }));
        if (result.reason instanceof ApiError) {
          for (const [name, messages] of Object.entries(result.reason.errors ?? {})) {
            const field = fields.find(([key]) => key === name);
            if (field && messages[0]) form.setError(field[0], { type: "server", message: messages[0] });
          }
        }
      };
      if (late.status === "rejected") restoreFailure(late, lateFields);
      if (delivery.status === "rejected") restoreFailure(delivery, deliveryFields);
      refreshAfterFailure.current = true;
      const savedPart = late.status === "fulfilled" && late.value ? "Late return rates saved. " : delivery.status === "fulfilled" && delivery.value ? "Delivery pricing saved. " : "";
      const failedPart = late.status === "rejected" && delivery.status === "rejected" ? "Could not confirm either pricing update." : late.status === "rejected" ? "Could not confirm the late return update." : "Could not confirm the delivery pricing update.";
      const message = `${savedPart}${failedPart} Review the fields and retry.`;
      form.setError("root", { message });
      appToast.error(message);
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  const fields = (items: readonly (readonly [PricingField, string])[]) => items.map(([name, label]) => (
    <Controller key={name} name={name} control={form.control} render={({ field, fieldState }) => (
      <InputWithLabel {...field} id={name} label={label} required={editing} type="text" inputMode="decimal" autoComplete="off"
        inputClassName="disabled:bg-background disabled:opacity-100"
        disabled={!editing || busy} error={fieldState.error?.message}
        onChange={event => { if (/^\d*(?:\.\d*)?$/.test(event.target.value)) field.onChange(event.target.value); }} />
    )} />
  ));

  return <Card aria-label="Fee pricing" className="gap-0 border-border bg-surface py-0">
    <form noValidate onSubmit={event => {
      if (!editing || pending.current) { event.preventDefault(); return; }
      void form.handleSubmit(submit, () => appToast.error("Check the highlighted pricing fields."))(event);
    }}>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 sm:px-6">
        <CardTitle className="text-sm font-semibold"><h2 id="late-return-pricing-heading">Late return rates</h2></CardTitle>
        <CardAction className="ml-auto self-auto">
          {editing ? <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={cancel}>Cancel</Button>
            <Button type="submit" disabled={busy} aria-busy={busy}>{busy ? "Saving..." : "Save"}</Button>
          </div> : <Button type="button" variant="outline" disabled={loading || Boolean(loadError)} onClick={() => { form.clearErrors(); setEditing(true); }}><Settings2 size={15} aria-hidden="true" />Configure</Button>}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-5 p-4 sm:p-6">
        {loading ? <p role="status" className="text-sm text-muted-foreground">Loading pricing...</p> : loadError ? <div role="alert" className="space-y-3"><p className="text-sm text-destructive">{loadError}</p><Button type="button" variant="outline" onClick={() => { setLoading(true); setReload(value => value + 1); }}>Try again</Button></div> : <>
          <fieldset disabled={!editing || busy} aria-labelledby="late-return-pricing-heading" className="grid gap-4 sm:grid-cols-2">{fields(lateFields)}</fieldset>
          <section aria-labelledby="delivery-pricing-heading" className="space-y-4 border-t border-border pt-5">
            <h2 id="delivery-pricing-heading" className="text-sm font-semibold text-foreground">Delivery pricing</h2>
            <fieldset disabled={!editing || busy} aria-labelledby="delivery-pricing-heading" className="grid gap-4 sm:grid-cols-3">{fields(deliveryFields)}</fieldset>
          </section>
          {form.formState.errors.root?.message ? <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
        </>}
      </CardContent>
    </form>
  </Card>;
}
