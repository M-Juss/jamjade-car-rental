"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError } from "@/services/http";
import {
  getDeliveryPricing,
  saveDeliveryPricing,
} from "@/services/delivery/delivery.service";
import {
  deliveryPricingSchema,
  type DeliveryPricingValues,
} from "@/validations/delivery/schemas";
import { appToast } from "@/lib/toast";
const fields = [
  ["minimum_fee", "Minimum delivery fee (PHP)"],
  ["included_km", "Included distance (km)"],
  ["per_km_rate", "Additional price per km (PHP)"],
] as const;
export function DeliveryPricingForm() {
  const form = useForm<DeliveryPricingValues>({
    resolver: zodResolver(deliveryPricingSchema),
    defaultValues: {
      minimum_fee: "150",
      included_km: "1",
      per_km_rate: "25",
    },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    getDeliveryPricing()
      .then((settings) => {
        if (active) {
          form.reset({
            minimum_fee: String(settings.minimum_fee),
            included_km: String(settings.included_km),
            per_km_rate: String(settings.per_km_rate),
          });
          setError(null);
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof ApiError && e.status === 403
              ? "Only administrators can edit delivery pricing."
              : "Delivery pricing could not be loaded.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [form, reload]);
  const submit = async (data: DeliveryPricingValues) => {
    try {
      await saveDeliveryPricing(data);
      form.clearErrors();
      appToast.success(
        "Delivery pricing saved. New quotes will use these settings.",
      );
    } catch (e) {
      if (e instanceof ApiError)
        for (const [key, messages] of Object.entries(e.errors ?? {})) {
          const field = fields.find(([name]) => name === key);
          form.setError(field ? field[0] : "root", { message: messages[0] });
        }
      appToast.error(
        "Delivery pricing could not be saved. Check the highlighted fields.",
      );
    }
  };
  if (loading)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading delivery pricing...
      </p>
    );
  if (error)
    return (
      <div role="alert" className="space-y-3 text-sm text-destructive">
        <p>{error}</p>
        <Button
          variant="outline"
          onClick={() => {
            setLoading(true);
            setReload((v) => v + 1);
          }}
        >
          Try Again
        </Button>
      </div>
    );
  return (
    <Card className="rounded-2xl border-border bg-surface">
      <CardContent className="p-4 sm:p-6">
        <form
          onSubmit={form.handleSubmit(submit, () =>
            appToast.error("Check the highlighted delivery pricing fields."),
          )}
          className="space-y-5"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {fields.map(([name, label]) => (
              <InputWithLabel
                key={name}
                id={name}
                label={label}
                required
                disabled={form.formState.isSubmitting}
                type="number"
                step="any"
                error={form.formState.errors[name]?.message}
                {...form.register(name)}
              />
            ))}
          </div>
          {form.formState.errors.root && (
            <p role="alert" className="text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}
          <Button disabled={form.formState.isSubmitting} type="submit">
            {form.formState.isSubmitting
              ? "Saving..."
              : "Save Delivery Pricing"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
