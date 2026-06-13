export type DrivingIntent = 'self-drive' | 'owner-driver' | 'not-sure' | null;

export type SelfDriveStatus = 'not-eligible' | 'not-verified' | 'pending' | 'verified';

export type DocumentVerificationStatus =
  | 'not-submitted'
  | 'pending-review'
  | 'verified'
  | 'rejected';

export type CustomerDocumentId =
  | 'driver-license'
  | 'passport'
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

export type CustomerDocumentUploads = {
  driverLicenseNumber: string;
  driverLicenseExpirationDate: string;
  driverLicenseFront: string;
  driverLicenseBack: string;
  proofOfAddress: string;
  passport: string;
  passportRequiredByAdmin: boolean;
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
  bookingStatus: 'none' | 'pending' | 'active' | 'ongoing' | 'completed';
  successfulBookings: number;
  totalSpent: number;
  joinedAt: string;
};

export type BasicCustomerProfileInput = Pick<
  Customer,
  'firstName' | 'lastName' | 'contactNumber' | 'birthdate' | 'address' | 'profilePicture'
>;

export type DocumentVerificationInput = CustomerDocumentUploads;
