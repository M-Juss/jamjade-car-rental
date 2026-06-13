import type { BookingFormData } from '@/types/browse';

type BookingFlowStage = 'review' | 'payment';

type BookingFlow = {
  id: string;
  booking: BookingFormData;
  signature: string | null;
  stage: BookingFlowStage;
};

let activeFlow: BookingFlow | null = null;

function createFlowId() {
  return `booking-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function startBookingFlow(booking: BookingFormData) {
  activeFlow = {
    id: createFlowId(),
    booking,
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

export function submitBookingTerms(flowId: string, signature: string) {
  const flow = getBookingFlow(flowId);

  if (!flow || flow.stage !== 'review' || !signature.trim()) {
    return null;
  }

  activeFlow = {
    ...flow,
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
