import { useSyncExternalStore } from 'react';

import { BOOKMARKED_VEHICLE_IDS } from '@/lib/browse/mock-data';

const bookmarkedVehicleIds = new Set(BOOKMARKED_VEHICLE_IDS);
let snapshot = Array.from(bookmarkedVehicleIds);
const listeners = new Set<() => void>();

function emitChange() {
  snapshot = Array.from(bookmarkedVehicleIds);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function toggleBookmarkedVehicle(vehicleId: string) {
  if (bookmarkedVehicleIds.has(vehicleId)) {
    bookmarkedVehicleIds.delete(vehicleId);
  } else {
    bookmarkedVehicleIds.add(vehicleId);
  }

  emitChange();
}

export function useBookmarkedVehicleIds() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}
