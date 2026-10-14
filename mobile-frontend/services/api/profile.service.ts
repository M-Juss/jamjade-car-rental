import { apiGet, apiPost, apiPut } from '@/services/http';

import type {
  EmergencyContactPayload,
  MobileCustomerProfile,
  MobileProfileOverview,
  ProfileCompletionPayload,
  ProfileUpdatePayload,
} from './types';

export async function getProfile() {
  const response = await apiGet<MobileProfileOverview>('/mobile/profile');

  return response.data;
}

function isLocalFileUri(value?: string) {
  return Boolean(value && !/^https?:\/\//i.test(value));
}

function getUploadName(uri: string) {
  const cleanUri = uri.split('?')[0];
  const fileName = cleanUri.split('/').pop();

  return fileName || `profile-${Date.now()}.jpg`;
}

function getUploadType(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase();

  if (extension === 'png') {
    return 'image/png';
  }

  if (extension === 'webp') {
    return 'image/webp';
  }

  return 'image/jpeg';
}

function buildProfileBody(payload: ProfileUpdatePayload) {
  const addressDetails = payload.addressDetails;
  const body = {
    first_name: payload.firstName,
    last_name: payload.lastName,
    phone_number: payload.contactNumber,
    birthdate: payload.birthdate,
    address: payload.address,
    country_code: addressDetails.countryCode,
    region_code: addressDetails.regionCode,
    province_code: addressDetails.provinceCode ?? '',
    city_municipality_code: addressDetails.cityMunicipalityCode,
    barangay_code: addressDetails.barangayCode,
    address_line: addressDetails.addressLine,
    postal_code: addressDetails.postalCode,
  };

  if (!isLocalFileUri(payload.profilePicture)) {
    return body;
  }

  const formData = new FormData();

  Object.entries(body).forEach(([key, value]) => {
    formData.append(key, value);
  });

  const fileName = getUploadName(payload.profilePicture);
  formData.append('profile_picture', {
    name: fileName,
    type: getUploadType(fileName),
    uri: payload.profilePicture,
  } as unknown as Blob);

  return formData;
}

export async function updateProfile(payload: ProfileUpdatePayload) {
  const body = buildProfileBody(payload);
  const response = body instanceof FormData
    ? await apiPost<MobileCustomerProfile>('/mobile/profile', body)
    : await apiPut<MobileCustomerProfile>('/mobile/profile', body);

  return response.data;
}

export async function completeProfile(payload: ProfileCompletionPayload) {
  const response = await apiPost<MobileCustomerProfile>('/mobile/profile/complete', {
    driving_intent: payload.drivingIntent,
  });

  return response.data;
}

export async function saveEmergencyContact(payload: EmergencyContactPayload) {
  const response = await apiPost('/mobile/profile/emergency-contact', {
    name: payload.name,
    relationship: payload.relationship,
    phone_number: payload.contactNumber,
  });

  return response.data;
}

export async function skipEmergencyContact() {
  await apiPost<null>('/mobile/profile/emergency-contact/skip');
}
