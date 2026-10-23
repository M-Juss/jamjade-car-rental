import type { DeliveryQuote } from '@/services/api/delivery.service';

export function isReadyDeliveryQuote(quote: DeliveryQuote | null | undefined, now = Date.now()): quote is DeliveryQuote {
  return Boolean(quote && !quote.requiresRequote && quote.status === 'ready' && Date.parse(quote.expiresAt ?? '') > now);
}
