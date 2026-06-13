import type {
  CustomerDocumentId,
  CustomerDocumentUploads,
} from '@/types/customer';
import { apiPost } from '@/services/http';

import type { MobileDocument } from './types';

const DOCUMENT_TYPES: Record<CustomerDocumentId, string> = {
  'driver-license': 'drivers_license',
  passport: 'passport',
  'proof-of-address': 'proof_of_billing',
};

function isLocalFileUri(value: string) {
  return Boolean(value && !/^https?:\/\//i.test(value));
}

function getUploadName(uri: string, fieldName: string) {
  const cleanUri = uri.split('?')[0];
  const fileName = cleanUri.split('/').pop();

  return fileName && fileName.includes('.')
    ? fileName
    : `${fieldName}-${Date.now()}.jpg`;
}

function getUploadType(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase();

  if (extension === 'png') {
    return 'image/png';
  }

  if (extension === 'pdf') {
    return 'application/pdf';
  }

  return 'image/jpeg';
}

function appendUpload(formData: FormData, fieldName: string, uri: string) {
  if (!isLocalFileUri(uri)) {
    throw new Error('Choose a new document image before submitting again.');
  }

  const fileName = getUploadName(uri, fieldName);
  formData.append(fieldName, {
    name: fileName,
    type: getUploadType(fileName),
    uri,
  } as unknown as Blob);
}

function buildDocumentBody(
  documentId: CustomerDocumentId,
  documents: CustomerDocumentUploads,
) {
  const formData = new FormData();

  formData.append('document_type', DOCUMENT_TYPES[documentId]);

  if (documentId === 'driver-license') {
    formData.append('document_number', documents.driverLicenseNumber);
    formData.append('expires_at', documents.driverLicenseExpirationDate);
    appendUpload(formData, 'front_file', documents.driverLicenseFront);
    appendUpload(formData, 'back_file', documents.driverLicenseBack);
  } else if (documentId === 'passport') {
    appendUpload(formData, 'file', documents.passport);
  } else {
    appendUpload(formData, 'file', documents.proofOfAddress);
  }

  return formData;
}

export async function uploadCustomerDocument(
  documentId: CustomerDocumentId,
  documents: CustomerDocumentUploads,
) {
  const response = await apiPost<MobileDocument>(
    '/mobile/documents/upload',
    buildDocumentBody(documentId, documents),
  );

  return response.data;
}
