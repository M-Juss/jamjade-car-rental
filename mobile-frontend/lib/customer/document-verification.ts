import type {
  CustomerDocumentId,
  CustomerDocumentUploads,
  DocumentVerificationStatus,
} from '@/types/customer';

export type CustomerDocumentDefinition = {
  id: CustomerDocumentId;
  name: string;
  shortDescription: string;
  uploadDescription: string;
};

export const CUSTOMER_DOCUMENT_DEFINITIONS: CustomerDocumentDefinition[] = [
  {
    id: 'driver-license',
    name: "Driver's License",
    shortDescription: 'License details with clear front and back images.',
    uploadDescription: 'Add your license number, expiration date, and clear images of both sides.',
  },
  {
    id: 'proof-of-address',
    name: 'Proof of Address',
    shortDescription: 'Recent document showing your current address.',
    uploadDescription: 'Upload a clear, recent document showing your name and current residential address, such as a utility bill, billing statement, or official address document. Add the back image only if the document has one.',
  },
];

export function isCustomerDocumentId(value: string): value is CustomerDocumentId {
  return CUSTOMER_DOCUMENT_DEFINITIONS.some((document) => document.id === value);
}

export function getCustomerDocumentDefinition(documentId: CustomerDocumentId) {
  return CUSTOMER_DOCUMENT_DEFINITIONS.find((document) => document.id === documentId);
}

export function getDocumentStatusLabel(status: DocumentVerificationStatus) {
  if (status === 'pending-review') {
    return 'Pending';
  }

  if (status === 'verified') {
    return 'Verified';
  }

  if (status === 'rejected') {
    return 'Needs update';
  }

  return 'Not verified';
}

export function hasDocumentDraft(
  documentId: CustomerDocumentId,
  documents: CustomerDocumentUploads,
) {
  if (documentId === 'driver-license') {
    return Boolean(
      documents.driverLicenseNumber ||
        documents.driverLicenseExpirationDate ||
        documents.driverLicenseFront ||
        documents.driverLicenseBack,
    );
  }

  return Boolean(documents.proofOfAddress || documents.proofOfAddressBack);
}
