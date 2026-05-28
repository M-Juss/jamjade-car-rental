import type {
  BasicCustomerProfileInput,
  CustomerDocumentUploads,
  EmergencyContact,
} from '@/types/customer';
import { calculateAge, isFutureDate } from '@/utils/calculateAge';

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

export type BasicInfoField =
  | 'firstName'
  | 'lastName'
  | 'contactNumber'
  | 'birthdate'
  | 'address';

export type EmergencyContactField = 'name' | 'contactNumber' | 'relationship';

export type DocumentVerificationField =
  | 'driverLicenseNumber'
  | 'driverLicenseExpirationDate'
  | 'driverLicenseFront'
  | 'driverLicenseBack'
  | 'validId'
  | 'proofOfAddress'
  | 'passport';

export function isValidPhoneNumber(value: string) {
  const normalized = value.replace(/[\s()-]/g, '');

  return /^(\+?63|0)?9\d{9}$/.test(normalized) || /^\+?\d{10,15}$/.test(normalized);
}

export function validateBasicInfo(form: BasicCustomerProfileInput) {
  const errors: FieldErrors<BasicInfoField> = {};
  const age = calculateAge(form.birthdate);

  if (!form.firstName.trim()) {
    errors.firstName = 'First name is required.';
  }

  if (!form.lastName.trim()) {
    errors.lastName = 'Last name is required.';
  }

  if (!form.contactNumber.trim()) {
    errors.contactNumber = 'Contact number is required.';
  } else if (!isValidPhoneNumber(form.contactNumber)) {
    errors.contactNumber = 'Enter a valid contact number.';
  }

  if (!form.birthdate) {
    errors.birthdate = 'Birthdate is required.';
  } else if (isFutureDate(form.birthdate)) {
    errors.birthdate = 'Birthdate cannot be in the future.';
  } else if (age === null || age < 0) {
    errors.birthdate = 'Choose a valid birthdate.';
  }

  if (!form.address.trim()) {
    errors.address = 'Address is required.';
  }

  return errors;
}

export function validateEmergencyContact(contact: EmergencyContact) {
  const errors: FieldErrors<EmergencyContactField> = {};
  const hasAnyValue = Boolean(
    contact.name.trim() || contact.contactNumber.trim() || contact.relationship,
  );

  if (!hasAnyValue) {
    return errors;
  }

  if (!contact.name.trim()) {
    errors.name = 'Emergency contact name is required.';
  }

  if (!contact.contactNumber.trim()) {
    errors.contactNumber = 'Emergency contact number is required.';
  } else if (!isValidPhoneNumber(contact.contactNumber)) {
    errors.contactNumber = 'Enter a valid contact number.';
  }

  if (!contact.relationship) {
    errors.relationship = 'Select a relationship.';
  }

  return errors;
}

export function validateDocumentVerification(form: CustomerDocumentUploads) {
  const errors: FieldErrors<DocumentVerificationField> = {};

  if (!form.driverLicenseNumber.trim()) {
    errors.driverLicenseNumber = "Driver's license number is required.";
  }

  if (!form.driverLicenseExpirationDate) {
    errors.driverLicenseExpirationDate = "Driver's license expiration date is required.";
  } else if (!isFutureDate(form.driverLicenseExpirationDate)) {
    errors.driverLicenseExpirationDate = 'Expiration date must be in the future.';
  }

  if (!form.driverLicenseFront) {
    errors.driverLicenseFront = "Upload the driver's license front image.";
  }

  if (!form.driverLicenseBack) {
    errors.driverLicenseBack = "Upload the driver's license back image.";
  }

  if (!form.validId) {
    errors.validId = 'Upload a valid ID.';
  }

  if (!form.proofOfAddress) {
    errors.proofOfAddress = 'Upload proof of address or Meralco bill.';
  }

  if (form.passportRequiredByAdmin && !form.passport) {
    errors.passport = 'Passport upload is required by admin.';
  }

  return errors;
}

export function hasErrors<T extends string>(errors: FieldErrors<T>) {
  return Object.values(errors).some(Boolean);
}
