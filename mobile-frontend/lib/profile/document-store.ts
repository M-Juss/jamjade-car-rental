import { useSyncExternalStore } from 'react';

import {
  renterDocumentDefinitions,
  type RenterDocument,
  type RenterDocumentId,
} from '@/lib/profile/profile-data';

const listeners = new Set<() => void>();
// Document image drafts remain in memory for the current Android session.
let renterDocuments = renterDocumentDefinitions;

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
  emitChange();
}
