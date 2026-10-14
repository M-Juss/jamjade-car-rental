export type VerificationStatus = "pending" | "approved" | "rejected";

export type DocumentType = "Proof of Address" | "Driver's License";

export type FileType = "image" | "pdf";

export type SelfDriveReviewStatus = "eligible" | "pending_review" | "needs_correction" | "documents_required" | "age_ineligible";

export type SelfDriveCustomer = {
  id: number;
  name: string;
  email: string;
  contactNumber: string | null;
  createdAt: string | null;
  canSelfDrive: boolean;
  reviewStatus: SelfDriveReviewStatus;
  ageEligible: boolean;
  requiredDocumentCount: number;
  documentCounts: { approved: number; pending: number; rejected: number; missing: number };
  documents?: { type: string; document: VerificationRecord | null }[];
};

export type BackendSelfDriveCustomer = Omit<SelfDriveCustomer, "documents"> & {
  documents?: { type: string; document: BackendVerificationRecord | null }[];
};

export type SelfDriveCustomerPage = {
  customers: SelfDriveCustomer[];
  currentPage: number;
  lastPage: number;
  total: number;
  summary: { total: number; eligible: number; notEligible: number };
};

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
