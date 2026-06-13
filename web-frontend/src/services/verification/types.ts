export type VerificationStatus = "pending" | "approved" | "rejected";

export type DocumentType = "Valid ID" | "Passport" | "Meralco Bill" | "Driver's License";

export type FileType = "image" | "pdf";

export type VerificationRecord = {
  id: string;
  backendId: number | string;
  customerName: string;
  email: string;
  contactNumber: string;
  dateOfBirth?: string;
  age?: number;
  address?: string;
  documentType: DocumentType;
  documentNumber?: string;
  expiresAt?: string;
  documentUrl: string;
  documentFrontUrl?: string;
  documentBackUrl?: string;
  fileType: FileType;
  submittedAt: string;
  status: VerificationStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionComment?: string;
};

export type BackendVerificationRecord = {
  id: number | string;
  verificationId?: string;
  documentType?: string;
  name?: string;
  documentNumber?: string | null;
  expiresAt?: string | null;
  statusKey?: string;
  fileUrl?: string | null;
  frontFileUrl?: string | null;
  backFileUrl?: string | null;
  fileType?: FileType | string;
  submittedAt?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  customer?: {
    name?: string | null;
    email?: string | null;
    contactNumber?: string | null;
    dateOfBirth?: string | null;
    age?: number | null;
    address?: string | null;
  } | null;
};
