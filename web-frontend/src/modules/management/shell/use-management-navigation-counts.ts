"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getManagementNavigationCounts, MANAGEMENT_COUNTS_CHANGED, type ManagementNavigationCounts } from "@/services/management/navigation.service";
import { useManagementSession } from "./context/ManagementSessionProvider";

export function useManagementNavigationCounts() {
  const { user, status } = useManagementSession();
  const pathname = usePathname();
  const canManageBookings = user?.permissions?.includes("manage bookings") === true;
  const canReviewDocuments = user?.permissions?.includes("review documents") === true;
  const enabled = status === "ready" && (canManageBookings || canReviewDocuments);
  const [result, setResult] = useState<{ userId: number; counts: ManagementNavigationCounts; error: boolean } | null>(null);

  useEffect(() => {
    if (!enabled || !user) return;
    let active = true;
    let inFlight = false;
    let reload = false;
    const load = async () => {
      if (inFlight) { reload = true; return; }
      inFlight = true;
      try {
        const counts = await getManagementNavigationCounts();
        if (active) setResult({ userId: user.id, counts, error: false });
      } catch {
        if (active) setResult({ userId: user.id, counts: { bookings: null, verification: null }, error: true });
      } finally {
        inFlight = false;
        if (active && reload) { reload = false; void load(); }
      }
    };
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    void load();
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    window.addEventListener(MANAGEMENT_COUNTS_CHANGED, refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(MANAGEMENT_COUNTS_CHANGED, refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [enabled, user, pathname]);

  const current = enabled && result?.userId === user?.id ? result : null;
  return {
    counts: {
      bookings: canManageBookings ? current?.counts.bookings ?? null : null,
      verification: canReviewDocuments ? current?.counts.verification ?? null : null,
    },
    error: current?.error ?? false,
  };
}
