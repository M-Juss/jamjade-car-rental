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

export type RenterDocumentId = 'drivers-license' | 'proof-of-billing';

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
    description: 'Clear front and back photos of your valid driver license.',
    status: 'Not Uploaded',
  },
  {
    id: 'proof-of-billing',
    name: 'Proof of Address',
    shortName: 'Address',
    description: 'Recent document showing your current address.',
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
