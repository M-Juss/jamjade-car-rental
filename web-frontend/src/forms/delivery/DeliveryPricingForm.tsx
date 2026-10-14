"use client";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
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
  ["garage_address", "Garage address"],
  ["garage_latitude", "Garage latitude"],
  ["garage_longitude", "Garage longitude"],
] as const;
export function DeliveryPricingForm() {
  const form = useForm<DeliveryPricingValues>({
    resolver: zodResolver(deliveryPricingSchema),
    defaultValues: {
      minimum_fee: "150",
      included_km: "1",
      per_km_rate: "25",
      garage_address: "Jamjade Garage",
      garage_latitude: "",
      garage_longitude: "",
    },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const values = useWatch({ control: form.control });
  useEffect(() => {
    let active = true;
    getDeliveryPricing()
      .then((settings) => {
        if (active) {
          form.reset(
            Object.fromEntries(
              Object.entries(settings).map(([key, value]) => [
                key,
                value == null ? "" : String(value),
              ]),
            ) as DeliveryPricingValues,
          );
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
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map(([name, label]) => (
              <InputWithLabel
                key={name}
                id={name}
                label={label}
                required
                disabled={form.formState.isSubmitting}
                type={name === "garage_address" ? "text" : "number"}
                step="any"
                error={form.formState.errors[name]?.message}
                {...form.register(name)}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Fee = minimum + distance beyond included kilometres × rate, rounded
            to the nearest peso. No service distance limit is set. A 5 km route
            currently costs PHP{" "}
            {Number.isFinite(Number(values.minimum_fee))
              ? Math.round(
                  Number(values.minimum_fee) +
                    Math.max(0, 5 - Number(values.included_km)) *
                      Number(values.per_km_rate),
                )
              : "—"}
            . Valid quotes and accepted bookings keep their saved amounts.
          </p>
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
