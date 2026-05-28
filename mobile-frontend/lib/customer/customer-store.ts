import { useSyncExternalStore } from 'react';

import type {
  BasicCustomerProfileInput,
  Customer,
  DocumentVerificationInput,
  DrivingIntent,
  EmergencyContact,
  SelfDriveStatus,
} from '@/types/customer';
import { calculateAge } from '@/utils/calculateAge';

const emptyEmergencyContact: EmergencyContact = {
  name: '',
  contactNumber: '',
  relationship: '',
};

const emptyDocuments = {
  driverLicenseNumber: '',
  driverLicenseExpirationDate: '',
  driverLicenseFront: '',
  driverLicenseBack: '',
  validId: '',
  proofOfAddress: '',
  passport: '',
  passportRequiredByAdmin: false,
};

export const mockCustomer: Customer = {
  id: 'CUS-001',
  email: 'customer@email.com',
  firstName: '',
  lastName: '',
  contactNumber: '',
  birthdate: '',
  age: null,
  address: '',
  profilePicture: '',
  emergencyContact: emptyEmergencyContact,
  isProfileComplete: false,
  isBelow18: false,
  drivingIntent: null,
  selfDriveStatus: 'not-verified',
  documentVerificationStatus: 'not-submitted',
  documents: emptyDocuments,
  bookingStatus: 'active',
};

const listeners = new Set<() => void>();
let customer = mockCustomer;

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
  return customer;
}

function updateCustomer(updater: (currentCustomer: Customer) => Customer) {
  customer = updater(customer);
  emitChange();
}

export function useCustomer() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function updateRegisteredEmail(email: string) {
  updateCustomer((currentCustomer) => ({
    ...currentCustomer,
    email,
  }));
}

export function createCustomerProfile(profile: BasicCustomerProfileInput) {
  // TODO: Connect to POST /customer/profile when the backend endpoint is ready.
  const computedAge = calculateAge(profile.birthdate);
  const isBelow18 = computedAge !== null && computedAge < 18;

  updateCustomer((currentCustomer) => ({
    ...currentCustomer,
    ...profile,
    age: computedAge,
    isBelow18,
    isProfileComplete: Boolean(
      profile.firstName.trim() &&
        profile.lastName.trim() &&
        profile.contactNumber.trim() &&
        profile.birthdate &&
        profile.address.trim(),
    ),
    selfDriveStatus: isBelow18 ? 'not-eligible' : currentCustomer.selfDriveStatus === 'not-eligible' ? 'not-verified' : currentCustomer.selfDriveStatus,
  }));
}

export function updateEmergencyContact(emergencyContact: EmergencyContact) {
  // TODO: Connect to PATCH /customer/emergency-contact when available.
  updateCustomer((currentCustomer) => ({
    ...currentCustomer,
    emergencyContact,
  }));
}

export function updateDrivingIntent(drivingIntent: DrivingIntent) {
  // TODO: Connect to PATCH /customer/driving-intent when available.
  updateCustomer((currentCustomer) => ({
    ...currentCustomer,
    drivingIntent,
  }));
}

export function updateSelfDriveStatus(selfDriveStatus: SelfDriveStatus) {
  // TODO: Connect to PATCH /customer/self-drive-status when available.
  updateCustomer((currentCustomer) => ({
    ...currentCustomer,
    selfDriveStatus: currentCustomer.isBelow18 ? 'not-eligible' : selfDriveStatus,
  }));
}

export function saveDocumentVerificationDraft(documents: DocumentVerificationInput) {
  // TODO: Connect to PATCH /customer/document-verification/draft when available.
  updateCustomer((currentCustomer) => ({
    ...currentCustomer,
    documents,
    selfDriveStatus: currentCustomer.isBelow18 ? 'not-eligible' : 'not-verified',
    documentVerificationStatus: 'not-submitted',
  }));
}

export function submitDocumentVerification(documents: DocumentVerificationInput) {
  // TODO: Connect to POST /customer/document-verification when available.
  updateCustomer((currentCustomer) => ({
    ...currentCustomer,
    documents,
    selfDriveStatus: currentCustomer.isBelow18 ? 'not-eligible' : 'pending',
    documentVerificationStatus: 'pending-review',
  }));
}

export function getCustomerFullName(currentCustomer: Customer) {
  return `${currentCustomer.firstName} ${currentCustomer.lastName}`.trim();
}

export function getCustomerInitials(currentCustomer: Customer) {
  const initials = [currentCustomer.firstName, currentCustomer.lastName]
    .filter(Boolean)
    .map((name) => name[0])
    .join('')
    .toUpperCase();

  return initials || 'JJ';
}

export function getSelfDriveBookingAvailability(currentCustomer: Customer) {
  if (currentCustomer.isBelow18 || currentCustomer.selfDriveStatus === 'not-eligible') {
    return {
      canSelfDrive: false,
      message: 'Self-drive is only available for customers who are 18 years old and above.',
    };
  }

  if (currentCustomer.selfDriveStatus !== 'verified') {
    return {
      canSelfDrive: false,
      message: 'Please verify your documents before booking a self-drive vehicle.',
    };
  }

  return {
    canSelfDrive: true,
    message: '',
  };
}

export function getCustomerStatusLabel(currentCustomer: Customer) {
  if (currentCustomer.selfDriveStatus === 'not-eligible') {
    return "Owner's Driver Only";
  }

  if (currentCustomer.selfDriveStatus === 'pending') {
    return 'Verification Pending';
  }

  if (currentCustomer.selfDriveStatus === 'verified') {
    return 'Self-drive Verified';
  }

  return 'Self-drive Not Verified';
}
