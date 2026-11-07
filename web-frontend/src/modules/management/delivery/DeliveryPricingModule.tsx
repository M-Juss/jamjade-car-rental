"use client";

import { ManagementPageHeading } from "@/modules/management/shell/components/ManagementPageHeading";
import { FeePricingForm } from "@/forms/pricing/FeePricingForm";
export function DeliveryPricingPage() {
  return (
    <div className="min-h-screen space-y-5 bg-background p-4 md:p-6 lg:p-8">
      <ManagementPageHeading
        title="Fee Pricing"
        description="Set delivery fees and late-return rates for new bookings."
      />
      <FeePricingForm />
    </div>
  );
}
