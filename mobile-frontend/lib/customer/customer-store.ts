import { useSyncExternalStore } from 'react';

import type {
  MobileDocument,
  MobileProfileOverview,
  MobileUser,
} from '@/services/api';
import type {
  BasicCustomerProfileInput,
  Customer,
  CustomerDocumentId,
  CustomerDocumentRejectionReasons,
  CustomerDocumentStatuses,
  DocumentVerificationInput,
  DrivingIntent,
  EmergencyContact,
  EmergencyRelationship,
  SelfDriveStatus,
} from '@/types/customer';
import {
  BOOKING_AGE_RESTRICTION_MESSAGE,
  calculateAge,
  isBookingAgeEligible,
} from '@/utils/calculateAge';

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
  proofOfAddress: '',
  passport: '',
  passportRequiredByAdmin: false,
};

const emptyDocumentStatuses: CustomerDocumentStatuses = {
  'driver-license': 'not-submitted',
  passport: 'not-submitted',
  'proof-of-address': 'not-submitted',
};

const emptyDocumentRejectionReasons: CustomerDocumentRejectionReasons = {
  'driver-license': '',
  passport: '',
  'proof-of-address': '',
};

export const emptyCustomer: Customer = {
  id: '',
  email: '',
  firstName: '',
  lastName: '',
  contactNumber: '',
  birthdate: '',
  age: null,
  address: '',
  profilePicture: '',
  emergencyContact: emptyEmergencyContact,
  emergencyContactSkipped: false,
  isProfileComplete: false,
  isBelow18: false,
  drivingIntent: null,
  selfDriveStatus: 'not-verified',
  documentVerificationStatus: 'not-submitted',
  documents: emptyDocuments,
  documentStatuses: emptyDocumentStatuses,
  documentRejectionReasons: emptyDocumentRejectionReasons,
  bookingStatus: 'none',
  successfulBookings: 0,
  totalSpent: 0,
  joinedAt: '',
};

const listeners = new Set<() => void>();
let customer = emptyCustomer;

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

function hasCompleteBasicProfile(currentCustomer: Customer) {
  return Boolean(
    currentCustomer.firstName.trim() &&
      currentCustomer.lastName.trim() &&
      currentCustomer.contactNumber.trim() &&
      currentCustomer.birthdate &&
      currentCustomer.address.trim(),
  );
}

function hasCompleteEmergencyContact(currentCustomer: Customer) {
  return Boolean(
    currentCustomer.emergencyContact.name.trim() &&
      currentCustomer.emergencyContact.contactNumber.trim() &&
      currentCustomer.emergencyContact.relationship,
  );
}

function isCustomerProfileSetupComplete(currentCustomer: Customer) {
  return (
    hasCompleteBasicProfile(currentCustomer) &&
    (hasCompleteEmergencyContact(currentCustomer) || currentCustomer.emergencyContactSkipped) &&
    currentCustomer.drivingIntent !== null
  );
}

export function useCustomer() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function mapDrivingIntent(intent?: string | null): DrivingIntent {
  if (intent === 'self_drive') {
    return 'self-drive';
  }

  if (intent === 'owner_driver') {
    return 'owner-driver';
  }

  if (intent === 'not_sure') {
    return 'not-sure';
  }

  return null;
}

export function hydrateCustomerFromUser(user: MobileUser) {
  const profile = user.profile;
  const birthdate = profile?.birthdate ?? '';
  const age = calculateAge(birthdate);
  const isBelow18 = age !== null && age < 18;
  const verificationStatus = profile?.verificationStatus;
  const selfDriveStatus: SelfDriveStatus = isBelow18
    ? 'not-eligible'
    : profile?.canSelfDrive
      ? 'verified'
      : verificationStatus === 'pending_review'
        ? 'pending'
        : 'not-verified';

  updateCustomer((currentCustomer) => ({
    ...currentCustomer,
    id: String(user.id),
    email: user.email,
    firstName: profile?.firstName ?? '',
    lastName: profile?.lastName ?? '',
    contactNumber: user.phoneNumber ?? profile?.phoneNumber ?? '',
    birthdate,
    age,
    address: profile?.address ?? '',
    profilePicture: profile?.profilePicture ?? '',
    documents: {
      ...currentCustomer.documents,
      passportRequiredByAdmin: Boolean(profile?.passportRequired),
    },
    emergencyContactSkipped: Boolean(profile?.emergencyContactSkippedAt),
    isProfileComplete: Boolean(profile?.profileCompletedAt),
    isBelow18,
    drivingIntent: mapDrivingIntent(profile?.drivingIntent),
    selfDriveStatus,
    joinedAt: user.createdAt?.slice(0, 10) ?? currentCustomer.joinedAt,
  }));
}

function mapDocumentType(documentType: string): CustomerDocumentId | null {
  if (documentType === 'drivers_license') {
    return 'driver-license';
  }

  if (documentType === 'proof_of_billing') {
    return 'proof-of-address';
  }

  if (documentType === 'passport') {
    return 'passport';
  }

  return null;
}

function mapDocumentStatus(status: string): CustomerDocumentStatuses[CustomerDocumentId] {
  if (status === 'approved') {
    return 'verified';
  }

  if (status === 'rejected') {
    return 'rejected';
  }

  return 'pending-review';
}

function getDocumentUploadValues(document: MobileDocument): Partial<DocumentVerificationInput> {
  const primaryUrl = document.fileUrl ?? '';
  const frontUrl = document.frontFileUrl ?? primaryUrl;
  const backUrl = document.backFileUrl ?? '';
  const needsReplacement = document.statusKey === 'rejected';

  if (document.documentType === 'drivers_license') {
    return {
      driverLicenseNumber: document.documentNumber ?? '',
      driverLicenseExpirationDate: document.expiresAt ?? '',
      driverLicenseFront: needsReplacement ? '' : frontUrl,
      driverLicenseBack: needsReplacement ? '' : backUrl,
    };
  }

  if (document.documentType === 'passport') {
    return { passport: needsReplacement ? '' : primaryUrl };
  }

  if (document.documentType === 'proof_of_billing') {
    return { proofOfAddress: needsReplacement ? '' : primaryUrl };
  }

  return {};
}

function preserveLocalReplacementImages(
  currentDocuments: DocumentVerificationInput,
  nextDocuments: DocumentVerificationInput,
  statuses: CustomerDocumentStatuses,
) {
  const localValue = (value: string, fallback: string) => (
    value && !/^https?:\/\//i.test(value) ? value : fallback
  );

  if (statuses['driver-license'] === 'rejected') {
    nextDocuments.driverLicenseFront = localValue(
      currentDocuments.driverLicenseFront,
      nextDocuments.driverLicenseFront,
    );
    nextDocuments.driverLicenseBack = localValue(
      currentDocuments.driverLicenseBack,
      nextDocuments.driverLicenseBack,
    );
  }

  if (statuses.passport === 'rejected') {
    nextDocuments.passport = localValue(
      currentDocuments.passport,
      nextDocuments.passport,
    );
  }

  if (statuses['proof-of-address'] === 'rejected') {
    nextDocuments.proofOfAddress = localValue(
      currentDocuments.proofOfAddress,
      nextDocuments.proofOfAddress,
    );
  }

  return nextDocuments;
}

export function hydrateCustomerFromProfile(overview: MobileProfileOverview) {
  hydrateCustomerFromUser({
    ...overview.user,
    profile: overview.profile,
  });

  const emergencyContact = overview.emergencyContacts[0];
  const documentStatuses = { ...emptyDocumentStatuses };
  const documentRejectionReasons = { ...emptyDocumentRejectionReasons };
  const documentUploads: Partial<DocumentVerificationInput> = {};

  overview.documents.forEach((document) => {
    const documentId = mapDocumentType(document.documentType);

    if (documentId) {
      documentStatuses[documentId] = mapDocumentStatus(document.statusKey);
      documentRejectionReasons[documentId] = document.rejectionReason ?? '';
      Object.assign(documentUploads, getDocumentUploadValues(document));
    }
  });

  updateCustomer((currentCustomer) => {
    const documents = preserveLocalReplacementImages(
      currentCustomer.documents,
      {
        ...currentCustomer.documents,
        ...documentUploads,
      },
      documentStatuses,
    );

    return {
      ...currentCustomer,
      emergencyContact: emergencyContact
        ? {
            name: emergencyContact.name,
            contactNumber: emergencyContact.phone_number,
            relationship: emergencyContact.relationship as EmergencyRelationship,
          }
        : { ...emptyEmergencyContact },
      documents,
      documentStatuses,
      documentRejectionReasons,
      bookingStatus: overview.bookingSummary.status,
      successfulBookings: overview.bookingSummary.successfulBookings,
      totalSpent: overview.bookingSummary.totalSpent,
      documentVerificationStatus: getOverallDocumentStatus(
        documentStatuses,
        documents.passportRequiredByAdmin,
      ),
    };
  });
}

export function resetCustomer() {
  customer = {
    ...emptyCustomer,
    emergencyContact: { ...emptyEmergencyContact },
    documents: { ...emptyDocuments },
    documentStatuses: { ...emptyDocumentStatuses },
    documentRejectionReasons: { ...emptyDocumentRejectionReasons },
  };
  emitChange();
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

  updateCustomer((currentCustomer) => {
    const nextCustomer = {
      ...currentCustomer,
      ...profile,
      age: computedAge,
      isBelow18,
      selfDriveStatus: isBelow18 ? 'not-eligible' : currentCustomer.selfDriveStatus === 'not-eligible' ? 'not-verified' : currentCustomer.selfDriveStatus,
    } satisfies Customer;

    return {
      ...nextCustomer,
      isProfileComplete: isCustomerProfileSetupComplete(nextCustomer),
    };
  });
}

export function updateEmergencyContact(emergencyContact: EmergencyContact) {
  // TODO: Connect to PATCH /customer/emergency-contact when available.
  updateCustomer((currentCustomer) => {
    const nextCustomer = {
      ...currentCustomer,
      emergencyContact,
      emergencyContactSkipped: false,
    };

    return {
      ...nextCustomer,
      isProfileComplete: isCustomerProfileSetupComplete(nextCustomer),
    };
  });
}

export function skipEmergencyContact() {
  updateCustomer((currentCustomer) => {
    const nextCustomer = {
      ...currentCustomer,
      emergencyContact: emptyEmergencyContact,
      emergencyContactSkipped: true,
    };

    return {
      ...nextCustomer,
      isProfileComplete: isCustomerProfileSetupComplete(nextCustomer),
    };
  });
}

export function updateDrivingIntent(drivingIntent: DrivingIntent) {
  // TODO: Connect to PATCH /customer/driving-intent when available.
  updateCustomer((currentCustomer) => {
    const nextCustomer = {
      ...currentCustomer,
      drivingIntent,
    };

    return {
      ...nextCustomer,
      isProfileComplete: isCustomerProfileSetupComplete(nextCustomer),
    };
  });
}

export function finalizeCustomerProfileSetup() {
  if (!hasCompleteBasicProfile(customer)) {
    return '/onboarding/basic-info' as const;
  }

  if (!hasCompleteEmergencyContact(customer) && !customer.emergencyContactSkipped) {
    return '/onboarding/emergency-contact' as const;
  }

  if (customer.drivingIntent === null) {
    return '/onboarding/driving-intent' as const;
  }

  updateCustomer((currentCustomer) => ({
    ...currentCustomer,
    isProfileComplete: true,
  }));

  return null;
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
    documentStatuses: {
      'driver-license': 'pending-review',
      passport:
        documents.passport || documents.passportRequiredByAdmin
          ? 'pending-review'
          : currentCustomer.documentStatuses.passport,
      'proof-of-address': 'pending-review',
    },
    selfDriveStatus: currentCustomer.isBelow18 ? 'not-eligible' : 'pending',
    documentVerificationStatus: 'pending-review',
  }));
}

function getOverallDocumentStatus(
  statuses: CustomerDocumentStatuses,
  passportRequired = false,
) {
  const requiredStatuses = [
    statuses['driver-license'],
    statuses['proof-of-address'],
    ...(passportRequired ? [statuses.passport] : []),
  ];

  if (requiredStatuses.every((status) => status === 'verified')) {
    return 'verified' as const;
  }

  if (requiredStatuses.some((status) => status === 'rejected')) {
    return 'rejected' as const;
  }

  if (requiredStatuses.every((status) => status === 'pending-review' || status === 'verified')) {
    return 'pending-review' as const;
  }

  return 'not-submitted' as const;
}

export function saveCustomerDocumentDraft(
  documentId: CustomerDocumentId,
  documents: DocumentVerificationInput,
) {
  // TODO: Connect to PATCH /customer/document-verification/draft when available.
  updateCustomer((currentCustomer) => ({
    ...currentCustomer,
    documents,
    documentStatuses: {
      ...currentCustomer.documentStatuses,
      [documentId]:
        currentCustomer.documentStatuses[documentId] === 'rejected'
          ? 'not-submitted'
          : currentCustomer.documentStatuses[documentId],
    },
  }));
}

export function submitCustomerDocument(
  documentId: CustomerDocumentId,
  documents: DocumentVerificationInput,
  submittedDocument?: MobileDocument,
) {
  updateCustomer((currentCustomer) => {
    const documentStatuses = {
      ...currentCustomer.documentStatuses,
      [documentId]: submittedDocument
        ? mapDocumentStatus(submittedDocument.statusKey)
        : 'pending-review',
    } satisfies CustomerDocumentStatuses;
    const documentVerificationStatus = getOverallDocumentStatus(
      documentStatuses,
      documents.passportRequiredByAdmin,
    );

    return {
      ...currentCustomer,
      documents: {
        ...documents,
        ...(submittedDocument ? getDocumentUploadValues(submittedDocument) : {}),
      },
      documentStatuses,
      documentRejectionReasons: {
        ...currentCustomer.documentRejectionReasons,
        [documentId]: submittedDocument?.rejectionReason ?? '',
      },
      documentVerificationStatus,
      selfDriveStatus: currentCustomer.isBelow18
        ? 'not-eligible'
        : documentVerificationStatus === 'pending-review'
          ? 'pending'
          : documentVerificationStatus === 'verified'
            ? 'verified'
            : 'not-verified',
    };
  });
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
      message: BOOKING_AGE_RESTRICTION_MESSAGE,
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

export function getBookingAgeAvailability(currentCustomer: Customer) {
  if (!currentCustomer.birthdate || currentCustomer.age === null) {
    return {
      canBook: false,
      message: 'Complete your profile and add a valid birthdate before booking.',
      reason: 'profile' as const,
    };
  }

  if (!isBookingAgeEligible(currentCustomer.birthdate)) {
    return {
      canBook: false,
      message: BOOKING_AGE_RESTRICTION_MESSAGE,
      reason: 'age' as const,
    };
  }

  return {
    canBook: true,
    message: '',
    reason: null,
  };
}

export function getCustomerStatusLabel(currentCustomer: Customer) {
  if (currentCustomer.selfDriveStatus === 'not-eligible') {
    return 'Booking Unavailable';
  }

  if (currentCustomer.selfDriveStatus === 'pending') {
    return 'Verification Pending';
  }

  if (currentCustomer.selfDriveStatus === 'verified') {
    return 'Self-drive Verified';
  }

  return 'Self-drive Not Verified';
}
