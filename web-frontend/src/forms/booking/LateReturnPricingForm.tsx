"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError } from "@/services/http";
import { getLateReturnPricing, saveLateReturnPricing } from "@/services/booking/late-return-pricing.service";
import { lateReturnPricingSchema, type LateReturnPricingValues } from "@/validations/booking/late-return";
import { appToast } from "@/lib/toast";

const fields = [["small_vehicle_hourly_rate", "5 seats or fewer (PHP/hour)"], ["large_vehicle_hourly_rate", "6 seats or more (PHP/hour)"]] as const;
export function LateReturnPricingForm() {
  const form = useForm<LateReturnPricingValues>({ resolver: zodResolver(lateReturnPricingSchema), defaultValues: { small_vehicle_hourly_rate: "", large_vehicle_hourly_rate: "" } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    getLateReturnPricing().then((settings) => {
      if (active) { form.reset({ small_vehicle_hourly_rate: String(settings.small_vehicle_hourly_rate), large_vehicle_hourly_rate: String(settings.large_vehicle_hourly_rate) }); setError(null); }
    }).catch((e) => { if (active) setError(e instanceof ApiError && e.status === 403 ? "Only administrators can edit pricing." : "Late return pricing could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [form, reload]);
  const submit = async (values: LateReturnPricingValues) => {
    try {
      await saveLateReturnPricing(values); form.clearErrors(); appToast.success("Late return pricing saved. Existing bookings keep their agreed rates.");
    } catch (e) {
      form.setError("root", { message: "Pricing could not be saved. Please check the fields and try again." });
      if (e instanceof ApiError) for (const [key, messages] of Object.entries(e.errors ?? {})) {
        const field = fields.find(([name]) => name === key);
        form.setError(field ? field[0] : "root", { message: messages[0] });
      }
      appToast.error("Late return pricing could not be saved.");
    }
  };
  if (loading) return <p role="status" className="text-sm text-muted-foreground">Loading late return pricing...</p>;
  if (error) return <div role="alert" className="space-y-3 text-sm text-destructive"><p>{error}</p><Button variant="outline" onClick={() => { setLoading(true); setReload((v) => v + 1); }}>Try Again</Button></div>;
  return <Card className="rounded-2xl border-border bg-surface"><CardContent className="p-4 sm:p-6">
    <form noValidate className="space-y-5" onSubmit={form.handleSubmit(submit, () => appToast.error("Check the highlighted late return pricing fields."))}>
      <div className="grid gap-4 sm:grid-cols-2">{fields.map(([name, label]) => <InputWithLabel key={name} id={name} label={label} required type="number" min="0.01" max="1000000" step="0.01" disabled={form.formState.isSubmitting} error={form.formState.errors[name]?.message} {...form.register(name)} />)}</div>
      {form.formState.errors.root?.message ? <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
      <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving..." : "Save Late Return Pricing"}</Button>
    </form>
  </CardContent></Card>;
}
