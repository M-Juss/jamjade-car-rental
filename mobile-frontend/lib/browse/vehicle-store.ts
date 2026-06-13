import { useSyncExternalStore } from 'react';

import type { Vehicle } from '@/types/browse';

let vehicles: Vehicle[] = [];
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

function getSnapshot() {
  return vehicles;
}

export function replaceVehicleCatalog(nextVehicles: Vehicle[]) {
  vehicles = nextVehicles;
  emitChange();
}

export function upsertVehicle(nextVehicle: Vehicle) {
  const existingIndex = vehicles.findIndex((vehicle) => vehicle.id === nextVehicle.id);

  if (existingIndex === -1) {
    vehicles = [...vehicles, nextVehicle];
  } else {
    vehicles = vehicles.map((vehicle) =>
      vehicle.id === nextVehicle.id ? nextVehicle : vehicle,
    );
  }

  emitChange();
}

export function resetVehicleCatalog() {
  vehicles = [];
  emitChange();
}

export function getVehicleById(vehicleId?: string) {
  return vehicles.find((vehicle) => vehicle.id === vehicleId);
}

export function useVehicleCatalog() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useCachedVehicle(vehicleId?: string) {
  return useSyncExternalStore(
    subscribe,
    () => getVehicleById(vehicleId),
    () => getVehicleById(vehicleId),
  );
}
