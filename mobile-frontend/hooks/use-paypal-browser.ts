import { useCallback, useEffect, useRef } from 'react';

import type { PayPalOrderResponse } from '@/services/api/types';
import { abandonPayPalOrder } from '@/services/api/payment.service';
import { openPayPalBrowser } from '@/services/payments/paypal-browser';

export function usePayPalBrowser() {
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const pendingOrder = useRef<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
      if (pendingOrder.current) {
        // The server permits abandonment only before capture. Never discard an
        // approved result or turn a failed cleanup request into a payment fact.
        void abandonPayPalOrder(pendingOrder.current).catch(() => undefined);
        pendingOrder.current = null;
      }
    };
  }, []);

  return useCallback(async (order: PayPalOrderResponse, target: 'customer' | 'driver' = 'customer') => {
    if (!mounted.current) {
      await abandonPayPalOrder(order.orderId).catch(() => undefined);
      return 'exited' as const;
    }
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    pendingOrder.current = order.orderId;
    try {
      const result = await openPayPalBrowser(order, target, next.signal);
      if (result === 'approved') pendingOrder.current = null;
      return mounted.current ? result : 'exited' as const;
    } finally {
      if (controller.current === next) controller.current = null;
    }
  }, []);
}
