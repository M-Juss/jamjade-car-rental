"use client";

import { useEffect, useRef, useState } from "react";
import { getFleetRentals } from "@/services/fleet/fleet.service";
import { subscribeFleetChanges, type FleetConnection } from "@/services/fleet/fleet-realtime";
import type { FleetRentalsPage } from "@/services/fleet/types";
import { ApiError } from "@/services/http";
import type { FleetQuery } from "@/validations/fleet/schemas";

export function useFleetRentals() {
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState<FleetQuery>({ page: 1 });
  const [page, setPage] = useState<FleetRentalsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<FleetConnection>("connecting");
  const [dataVersion, setDataVersion] = useState(0);
  const [reload, setReload] = useState(0);
  const requestRefresh = useRef<() => void>(() => {});
  const canSubscribe = Boolean(page) && !error;

  useEffect(() => {
    const timer = setTimeout(() => {
      if ((query.search ?? "") !== searchInput.trim()) {
        setLoading(true);
        setError(null);
        setQuery((current) => ({ ...current, search: searchInput.trim(), page: 1 }));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, query.search]);

  useEffect(() => {
    let disposed = false;
    let busy = false;
    let pending = false;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      if (disposed) return;
      if (busy) { pending = true; return; }
      busy = true;
      controller = new AbortController();
      const activeController = controller;
      const timeout = setTimeout(() => activeController.abort(), 10_000);
      try {
        const result = await getFleetRentals(query, controller.signal);
        if (disposed) return;
        if (result.total > 0 && result.page > result.lastPage) {
          setQuery((current) => ({ ...current, page: result.lastPage }));
          return;
        }
        setPage(result);
        setDataVersion(value => value + 1);
        setError(null);
      } catch (failure) {
        if (disposed) return;
        // Remove markers on errors, including permission revocation or expired login.
        setPage(null);
        setError(failure instanceof ApiError && failure.status === 403
          ? "You do not have access to Fleet Monitoring."
          : failure instanceof ApiError && failure.status === 401
            ? "Your session expired. Sign in again."
            : failure instanceof ApiError && failure.status === 422
              ? "Check the fleet search and filters, then try again."
              : "Active rentals could not be loaded. Try again.");
      } finally {
        clearTimeout(timeout);
        busy = false;
        if (!disposed) {
          setLoading(false);
          if (pending) { pending = false; schedule(); }
        }
      }
    }
    // Coalesce fleet notices, keeping at most one follow-up read during a request.
    function schedule() {
      if (disposed || document.visibilityState === "hidden") return;
      if (busy) { pending = true; return; }
      if (!timer) timer = setTimeout(() => { timer = undefined; void load(); }, 750);
    }
    requestRefresh.current = schedule;
    void load();
    // Reconcile missed events, recency, expiry and access even when sockets are down.
    const interval = setInterval(schedule, 30_000);
    document.addEventListener("visibilitychange", schedule);
    window.addEventListener("online", schedule);
    return () => {
      disposed = true;
      controller?.abort();
      clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", schedule);
      window.removeEventListener("online", schedule);
    };
  }, [query, reload]);

  useEffect(() => {
    if (!canSubscribe) return;
    return subscribeFleetChanges(() => requestRefresh.current(), setConnection);
  }, [canSubscribe]);

  const changeQuery = (changes: Partial<FleetQuery>) => {
    setLoading(true);
    setError(null);
    setQuery((current) => ({ ...current, ...changes }));
  };
  const refresh = () => {
    setLoading(true);
    setError(null);
    setReload((value) => value + 1);
  };

  return { searchInput, setSearchInput, query, page, loading, error, connection, dataVersion, changeQuery, refresh };
}
