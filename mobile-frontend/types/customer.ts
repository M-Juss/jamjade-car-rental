export type DrivingIntent = 'self-drive' | 'owner-driver' | 'not-sure' | null;

export type SelfDriveStatus = 'not-eligible' | 'not-verified' | 'pending' | 'verified';

export type DocumentVerificationStatus =
  | 'not-submitted'
  | 'pending-review'
  | 'verified'
  | 'rejected';

export type CustomerDocumentId =
  | 'driver-license'
  | 'proof-of-address';

export type CustomerDocumentStatuses = Record<CustomerDocumentId, DocumentVerificationStatus>;
export type CustomerDocumentRejectionReasons = Record<CustomerDocumentId, string>;

export type EmergencyRelationship =
  | 'Parent'
  | 'Sibling'
  | 'Spouse'
  | 'Guardian'
  | 'Friend'
  | 'Other'
  | '';

export type EmergencyContact = {
  name: string;
  contactNumber: string;
  relationship: EmergencyRelationship;
};

export type CustomerAddress = {
  countryCode: string;
  regionCode: string;
  provinceCode: string | null;
  cityMunicipalityCode: string;
  barangayCode: string;
  addressLine: string;
  postalCode: string;
  formattedAddress: string;
};

export type CustomerDocumentUploads = {
  driverLicenseNumber: string;
  driverLicenseExpirationDate: string;
  driverLicenseFront: string;
  driverLicenseBack: string;
  proofOfAddress: string;
  proofOfAddressBack: string;
};

export type Customer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  contactNumber: string;
  birthdate: string;
  age: number | null;
  address: string;
  addressDetails: CustomerAddress;
  profilePicture: string;
  emergencyContact: EmergencyContact;
  emergencyContactSkipped: boolean;
  isProfileComplete: boolean;
  isBelow18: boolean;
  drivingIntent: DrivingIntent;
  selfDriveStatus: SelfDriveStatus;
  documentVerificationStatus: DocumentVerificationStatus;
  documents: CustomerDocumentUploads;
  documentStatuses: CustomerDocumentStatuses;
  documentRejectionReasons: CustomerDocumentRejectionReasons;
  bookingStatus: 'none' | 'pending' | 'active' | 'ongoing' | 'returned' | 'completed';
  successfulBookings: number;
  totalSpent: number;
  hasOutstandingBalance: boolean;
  joinedAt: string;
};

export type BasicCustomerProfileInput = Pick<
  Customer,
  'firstName' | 'lastName' | 'contactNumber' | 'birthdate' | 'address' | 'profilePicture'
> & {
  addressDetails: CustomerAddress;
};

export type DocumentVerificationInput = CustomerDocumentUploads;
