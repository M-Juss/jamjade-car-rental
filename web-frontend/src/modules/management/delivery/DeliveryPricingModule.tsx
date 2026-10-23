"use client";

import { ManagementPageHeading } from "@/modules/management/shell/components/ManagementPageHeading";
import { LateReturnPricingForm } from "@/forms/booking/LateReturnPricingForm";
import { DeliveryPricingForm } from "@/forms/delivery/DeliveryPricingForm";
export function DeliveryPricingPage() {
  return (
    <div className="min-h-screen space-y-5 bg-background p-4 md:p-6 lg:p-8">
      <ManagementPageHeading
        title="Fee Pricing"
        description="Set delivery fees and late-return rates for new bookings."
      />
      <section aria-labelledby="late-return-pricing-heading" className="space-y-3">
        <h2 id="late-return-pricing-heading" className="text-base font-semibold text-foreground">Late Return Rates</h2>
        <LateReturnPricingForm />
      </section>
      <section aria-labelledby="delivery-pricing-heading" className="space-y-3">
        <h2 id="delivery-pricing-heading" className="text-base font-semibold text-foreground">Delivery Pricing</h2>
        <DeliveryPricingForm />
      </section>
    </div>
  );
}
