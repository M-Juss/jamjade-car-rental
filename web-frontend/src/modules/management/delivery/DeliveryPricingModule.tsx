import { DeliveryPricingForm } from "@/forms/delivery/DeliveryPricingForm";
export function DeliveryPricingPage() {
  return (
    <div className="min-h-screen space-y-5 bg-background p-4 md:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Delivery Pricing
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Set garage location and delivery rates for new quotes.
        </p>
      </div>
      <DeliveryPricingForm />
    </div>
  );
}
