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

export type RenterDocumentId = 'drivers-license' | 'passport' | 'proof-of-billing';

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

export const renterDocumentDefinitions: RenterDocument[] = [
  {
    id: 'drivers-license',
    name: "Driver's License",
    shortName: 'License',
    description: 'Front photo of your valid driver license.',
    status: 'Not Uploaded',
  },
  {
    id: 'passport',
    name: 'Passport',
    shortName: 'Passport',
    description: 'Supporting ID requested by the admin for renter verification.',
    status: 'Not Uploaded',
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
