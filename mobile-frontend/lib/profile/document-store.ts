import { useSyncExternalStore } from 'react';

import {
  initialRenterDocuments,
  type RenterDocument,
  type RenterDocumentId,
} from '@/lib/profile/profile-data';

const STORAGE_KEY = 'jamjade:renter-documents';

const listeners = new Set<() => void>();

function getStorage() {
  const storageHost = globalThis as typeof globalThis & {
    localStorage?: {
      getItem: (key: string) => string | null;
      setItem: (key: string, value: string) => void;
      removeItem: (key: string) => void;
    };
  };

  return storageHost.localStorage;
}

function readStoredDocuments() {
  const storage = getStorage();

  if (!storage) {
    return initialRenterDocuments;
  }

  try {
    const storedValue = storage.getItem(STORAGE_KEY);

    if (!storedValue) {
      return initialRenterDocuments;
    }

    const storedDocuments = JSON.parse(storedValue) as RenterDocument[];
    const storedById = new Map(storedDocuments.map((document) => [document.id, document]));

    return initialRenterDocuments.map((document) => ({
      ...document,
      ...storedById.get(document.id),
    }));
  } catch {
    storage.removeItem(STORAGE_KEY);
    return initialRenterDocuments;
  }
}

let renterDocuments = readStoredDocuments();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function persistDocuments() {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(renterDocuments));
  } catch {
    // Large image previews may exceed web storage. Keep the in-memory copy for this session.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return renterDocuments;
}

export function useRenterDocuments() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function storeRenterDocumentImage(documentId: RenterDocumentId, imageUri: string) {
  renterDocuments = renterDocuments.map((document) =>
    document.id === documentId
      ? {
          ...document,
          imageUri,
          status: 'Pending',
          updatedAt: new Date().toISOString(),
        }
      : document,
  );
  persistDocuments();
  emitChange();
}

export function removeRenterDocumentImage(documentId: RenterDocumentId) {
  renterDocuments = renterDocuments.map((document) =>
    document.id === documentId
      ? {
          ...document,
          imageUri: undefined,
          status: 'Not Uploaded',
          updatedAt: undefined,
        }
      : document,
  );
  persistDocuments();
  emitChange();
}
