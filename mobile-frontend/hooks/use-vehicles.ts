import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getVehicle as fetchVehicle,
  getBrowseVehicles,
} from '@/services/api';
import {
  replaceVehicleCatalog,
  upsertVehicle,
  useCachedVehicle,
  useVehicleCatalog,
} from '@/lib/browse/vehicle-store';
import { useAuth } from '@/providers/AuthProvider';
import type { Vehicle } from '@/types/browse';

function getRequestErrorMessage(_error?: unknown) {
  return 'Unable to load vehicles. Please try again.';
}

function useCustomerCatalogId() {
  const { status, user } = useAuth();
  return status === 'authenticated' && user?.roles?.includes('customer') ? user.id : null;
}

export function useBrowseVehicles(forCustomer: boolean) {
  const authenticatedCustomerId = useCustomerCatalogId();
  const customerId = forCustomer ? authenticatedCustomerId : null;
  const vehicles = useVehicleCatalog(customerId);
  const request = useRef<AbortController | null>(null);
  const [isLoading, setIsLoading] = useState(vehicles.length === 0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setIsLoading(true);
    setError(null);

    try {
      const nextVehicles = await getBrowseVehicles(customerId !== null, controller.signal);
      if (!controller.signal.aborted) replaceVehicleCatalog(customerId, nextVehicles);
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setError(getRequestErrorMessage(requestError));
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [customerId]);

  useFocusEffect(useCallback(() => {
    void refresh();
    return () => request.current?.abort();
  }, [refresh]));

  return {
    vehicles,
    isLoading,
    error,
    refresh,
  };
}

export function useVehicle(vehicleId?: string) {
  const customerId = useCustomerCatalogId();
  const vehicle = useCachedVehicle(customerId, vehicleId);
  const request = useRef<{ controller: AbortController; result: Promise<Vehicle | null> } | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(vehicleId && !vehicle));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!vehicleId) return Promise.resolve(null);
    if (request.current) return request.current.result;
    const controller = new AbortController();
    setError(null);

    const result = fetchVehicle(vehicleId, customerId !== null, controller.signal).then((nextVehicle) => {
      if (controller.signal.aborted) return null;
      upsertVehicle(customerId, nextVehicle);
      return nextVehicle;
    }).catch((requestError) => {
      if (!controller.signal.aborted) setError(getRequestErrorMessage(requestError));
      return null;
    }).finally(() => {
      if (request.current?.controller === controller) request.current = null;
      if (!controller.signal.aborted) setIsLoading(false);
    });
    request.current = { controller, result };
    return result;
  }, [customerId, vehicleId]);

  const reload = useCallback(async () => {
    if (!vehicleId) return;
    setIsLoading(true);
    await refresh();
  }, [refresh, vehicleId]);

  useEffect(() => () => {
    request.current?.controller.abort();
    request.current = null;
  }, [refresh]);

  useEffect(() => {
    if (vehicle || !vehicleId) {
      setIsLoading(false);
      return;
    }

    void reload();
  }, [reload, vehicle, vehicleId]);

  return {
    vehicle,
    isLoading,
    error,
    reload,
    refresh,
  };
}
