import { useSyncExternalStore } from 'react';

import type { Vehicle } from '@/types/browse';

const catalogs = new Map<number | null, Vehicle[]>();
const emptyCatalog: Vehicle[] = [];
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getCatalog(customerId: number | null) {
  return catalogs.get(customerId) ?? emptyCatalog;
}

export function replaceVehicleCatalog(customerId: number | null, vehicles: Vehicle[]) {
  catalogs.set(customerId, vehicles);
  emitChange();
}

export function upsertVehicle(customerId: number | null, nextVehicle: Vehicle) {
  const vehicles = getCatalog(customerId);
  const updated = vehicles.some((vehicle) => vehicle.id === nextVehicle.id)
    ? vehicles.map((vehicle) => vehicle.id === nextVehicle.id ? nextVehicle : vehicle)
    : [...vehicles, nextVehicle];
  replaceVehicleCatalog(customerId, updated);
}

export function resetVehicleCatalog() {
  catalogs.clear();
  emitChange();
}

export function useVehicleCatalog(customerId: number | null) {
  return useSyncExternalStore(subscribe, () => getCatalog(customerId));
}

export function useCachedVehicle(customerId: number | null, vehicleId?: string) {
  return useSyncExternalStore(
    subscribe,
    () => getCatalog(customerId).find((vehicle) => vehicle.id === vehicleId),
  );
}
