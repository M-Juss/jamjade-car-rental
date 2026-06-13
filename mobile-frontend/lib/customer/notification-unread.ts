import { useSyncExternalStore } from 'react';

let unreadNotificationCount = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return unreadNotificationCount;
}

export function setUnreadNotificationCount(count: number) {
  const nextCount = Math.max(0, count);

  if (nextCount === unreadNotificationCount) {
    return;
  }

  unreadNotificationCount = nextCount;
  listeners.forEach((listener) => listener());
}

export function useUnreadNotificationCount() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
