import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getVehicle as fetchVehicle,
  getAvailableVehicles,
} from '@/services/api';
import {
  replaceVehicleCatalog,
  upsertVehicle,
  useCachedVehicle,
  useVehicleCatalog,
} from '@/lib/browse/vehicle-store';

function getRequestErrorMessage(_error?: unknown) {
  return 'Unable to load vehicles. Please try again.';
}

export function useAvailableVehicles() {
  const catalog = useVehicleCatalog();
  const mounted = useRef(true);
  const [isLoading, setIsLoading] = useState(catalog.length === 0);
  const [error, setError] = useState<string | null>(null);
  const vehicles = useMemo(
    () => catalog.filter((vehicle) => vehicle.status === 'available'),
    [catalog],
  );

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextVehicles = await getAvailableVehicles();
      replaceVehicleCatalog(nextVehicles);
    } catch (requestError) {
      if (mounted.current) {
        setError(getRequestErrorMessage(requestError));
      }
    } finally {
      if (mounted.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    vehicles,
    isLoading,
    error,
    refresh,
  };
}

export function useVehicle(vehicleId?: string) {
  const vehicle = useCachedVehicle(vehicleId);
  const mounted = useRef(true);
  const [isLoading, setIsLoading] = useState(Boolean(vehicleId && !vehicle));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!vehicleId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextVehicle = await fetchVehicle(vehicleId);
      upsertVehicle(nextVehicle);
    } catch (requestError) {
      if (mounted.current) {
        setError(getRequestErrorMessage(requestError));
      }
    } finally {
      if (mounted.current) {
        setIsLoading(false);
      }
    }
  }, [vehicleId]);

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
  };
}
