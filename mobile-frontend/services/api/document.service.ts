import type {
  CustomerDocumentId,
  CustomerDocumentUploads,
} from '@/types/customer';
import { apiGet, apiPost } from '@/services/http';
import { formatDriverLicenseNumber, isValidDriverLicenseNumber } from '@/lib/customer/driver-license';
import { z } from 'zod';

const privacyNoticeVersionSchema = z.literal('document-privacy-v1');

export async function getDocumentPrivacyNotice() {
  return (await apiGet<{ version: string; contact_email: string }>('/mobile/documents/privacy-notice')).data;
}

import type { MobileDocument } from './types';
import { mapCustomerDocument } from './profile-mapping';

const DOCUMENT_TYPES: Record<CustomerDocumentId, string> = {
  'driver-license': 'drivers_license',
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
  privacyNoticeVersion: string,
) {
  const formData = new FormData();

  formData.append('document_type', DOCUMENT_TYPES[documentId]);
  formData.append('privacy_notice_version', privacyNoticeVersionSchema.parse(privacyNoticeVersion));

  if (documentId === 'driver-license') {
    if (!isValidDriverLicenseNumber(documents.driverLicenseNumber)) {
      throw new Error('Enter a license number with at most 11 letters or digits.');
    }
    formData.append('document_number', formatDriverLicenseNumber(documents.driverLicenseNumber));
    formData.append('expires_at', documents.driverLicenseExpirationDate);
    appendUpload(formData, 'front_file', documents.driverLicenseFront);
    appendUpload(formData, 'back_file', documents.driverLicenseBack);
  } else {
    appendUpload(formData, 'file', documents.proofOfAddress);
    if (documents.proofOfAddressBack) {
      appendUpload(formData, 'back_file', documents.proofOfAddressBack);
    }
  }

  return formData;
}

export async function uploadCustomerDocument(
  documentId: CustomerDocumentId,
  documents: CustomerDocumentUploads,
  privacyNoticeVersion: string,
) {
  const response = await apiPost<MobileDocument>(
    '/mobile/documents/upload',
    buildDocumentBody(documentId, documents, privacyNoticeVersion),
  );

  return mapCustomerDocument(response.data);
}
