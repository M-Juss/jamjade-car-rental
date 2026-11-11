import { bookingTermsSchema, bookingReviewedPricingSchema } from '@/validation/booking/schemas';
import type { BookingFormData, LateReturnPolicy, PriceBreakdown } from '@/types/browse';

type BookingFlowStage = 'review' | 'payment';

type BookingFlow = {
  id: string;
  booking: BookingFormData;
  signature: string | null;
  stage: BookingFlowStage;
  bookingReference?: string;
};

let activeFlow: BookingFlow | null = null;

function createFlowId() {
  return `booking-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function startBookingFlow(booking: BookingFormData, bookingReference?: string) {
  activeFlow = {
    id: createFlowId(),
    booking,
    bookingReference,
    signature: null,
    stage: 'review',
  };

  return activeFlow.id;
}

export function getBookingFlow(flowId?: string | null) {
  if (!flowId || activeFlow?.id !== flowId) {
    return null;
  }

  return activeFlow;
}

export function submitBookingTerms(flowId: string, signature: string, lateReturnPolicy: LateReturnPolicy, priceBreakdown: PriceBreakdown) {
  const flow = getBookingFlow(flowId);

  if (!flow || flow.stage !== 'review' || !bookingReviewedPricingSchema.safeParse(priceBreakdown).success || !bookingTermsSchema.safeParse({ signature, lateReturnPolicyVersion: lateReturnPolicy.version }).success) {
    return null;
  }

  activeFlow = {
    ...flow,
    booking: { ...flow.booking, lateReturnPolicy, priceBreakdown },
    signature,
    stage: 'payment',
  };

  return activeFlow;
}

export function resetBookingFlow(flowId?: string | null) {
  if (!flowId || activeFlow?.id === flowId) {
    activeFlow = null;
  }
}
