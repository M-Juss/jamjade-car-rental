export type CustomerProfile = {
  profilePicture: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  address: string;
  dateOfBirth: string;
  successfulBookings: number;
  totalSpent: number;
  joinedSince: string;
  accountStatus: 'Verified' | 'Pending';
};

export type RenterDocumentStatus = 'Verified' | 'Pending' | 'Not Uploaded';

export type RenterDocumentId = 'drivers-license' | 'valid-id' | 'passport' | 'proof-of-billing';

export type RenterDocument = {
  id: RenterDocumentId;
  name: string;
  shortName: string;
  description: string;
  status: RenterDocumentStatus;
  imageUri?: string;
  updatedAt?: string;
};

export type EditProfileForm = Pick<
  CustomerProfile,
  'firstName' | 'lastName' | 'phoneNumber' | 'address' | 'dateOfBirth'
>;

export const mockCustomerProfile: CustomerProfile = {
  profilePicture: '',
  firstName: 'Juan',
  lastName: 'Dela Cruz',
  email: 'juan.delacruz@gmail.com',
  phoneNumber: '0917 123 4567',
  address: 'Dasmarinas, Cavite',
  dateOfBirth: 'January 15, 2000',
  successfulBookings: 8,
  totalSpent: 24500,
  joinedSince: 'March 2026',
  accountStatus: 'Verified',
};

export const initialRenterDocuments: RenterDocument[] = [
  {
    id: 'drivers-license',
    name: "Driver's License",
    shortName: 'License',
    description: 'Front photo of your valid driver license.',
    status: 'Verified',
  },
  {
    id: 'valid-id',
    name: 'Valid ID',
    shortName: 'Valid ID',
    description: 'Government-issued ID used for renter identity checks.',
    status: 'Verified',
  },
  {
    id: 'passport',
    name: 'Passport',
    shortName: 'Passport',
    description: 'Optional supporting ID for renter verification.',
    status: 'Pending',
  },
  {
    id: 'proof-of-billing',
    name: 'Proof of Billing',
    shortName: 'Billing',
    description: 'Recent utility bill or billing statement with address.',
    status: 'Not Uploaded',
  },
];

export function getFullName(profile: CustomerProfile) {
  return `${profile.firstName} ${profile.lastName}`.trim();
}

export function getInitials(profile: CustomerProfile) {
  return [profile.firstName, profile.lastName]
    .filter(Boolean)
    .map((name) => name[0])
    .join('')
    .toUpperCase();
}
