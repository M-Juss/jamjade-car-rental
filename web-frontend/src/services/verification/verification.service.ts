import { apiGet, apiPost, resolveAssetUrl } from "@/services/http";
import type {
  BackendVerificationRecord,
  BackendSelfDriveCustomer,
  DocumentType,
  FileType,
  VerificationRecord,
  VerificationStatus,
  SelfDriveCustomer,
  SelfDriveCustomerPage,
} from "./types";

const DOCUMENT_TYPE_LABELS: Record<string, DocumentType> = {
  valid_id: "Valid ID",
  passport: "Passport",
  proof_of_billing: "Meralco Bill",
  drivers_license: "Driver's License",
};

const STATUS_MAP: Record<string, VerificationStatus> = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
};

function resolveDocumentUrl(url?: string | null) {
  return resolveAssetUrl(url) ?? "";
}

function getDocumentType(record: BackendVerificationRecord): DocumentType {
  if (record.name === "Valid ID" || record.name === "Passport" || record.name === "Meralco Bill" || record.name === "Driver's License") {
    return record.name;
  }

  return DOCUMENT_TYPE_LABELS[record.documentType ?? ""] ?? "Valid ID";
}

function getStatus(status?: string): VerificationStatus {
  return STATUS_MAP[status ?? ""] ?? "pending";
}

function getFileType(fileType?: string): FileType {
  return fileType === "pdf" ? "pdf" : "image";
}

function toVerificationRecord(record: BackendVerificationRecord): VerificationRecord {
  const documentUrl = resolveDocumentUrl(record.fileUrl);
  const documentFrontUrl = resolveDocumentUrl(record.frontFileUrl) || documentUrl;
  const documentBackUrl = resolveDocumentUrl(record.backFileUrl);

  return {
    id: record.verificationId ?? `VRF-${String(record.id).padStart(3, "0")}`,
    backendId: record.id,
    customerName: record.customer?.name ?? "Unknown Customer",
    email: record.customer?.email ?? "Not provided",
    contactNumber: record.customer?.contactNumber ?? "Not provided",
    dateOfBirth: record.customer?.dateOfBirth ?? undefined,
    age: record.customer?.age ?? undefined,
    address: record.customer?.address ?? undefined,
    documentType: getDocumentType(record),
    documentNumber: record.documentNumber ?? undefined,
    expiresAt: record.expiresAt ?? undefined,
    documentUrl,
    documentFrontUrl: documentFrontUrl || undefined,
    documentBackUrl: documentBackUrl || undefined,
    fileType: getFileType(record.fileType),
    submittedAt: record.submittedAt ?? new Date().toISOString(),
    status: getStatus(record.statusKey),
    reviewedBy: record.reviewedBy ?? undefined,
    reviewedAt: record.reviewedAt ?? undefined,
    rejectionComment: record.rejectionReason ?? undefined,
  };
}

function toCustomer(customer: BackendSelfDriveCustomer): SelfDriveCustomer {
  return {
    ...customer,
    documents: customer.documents?.map(({ type, document }) => ({
      type,
      document: document ? toVerificationRecord(document) : null,
    })),
  };
}

export async function getSelfDriveCustomers(params: {
  search?: string;
  eligibility?: "all" | "eligible" | "not_eligible";
  page: number;
}): Promise<SelfDriveCustomerPage> {
  const query = new URLSearchParams({ page: String(params.page) });
  if (params.search) query.set("search", params.search);
  if (params.eligibility && params.eligibility !== "all") query.set("eligibility", params.eligibility);
  const response = await apiGet<BackendSelfDriveCustomer[]>(`/admin/self-drive-verification/customers?${query}`);
  const meta = response.meta ?? {};
  const summary = (meta.summary ?? {}) as Partial<SelfDriveCustomerPage["summary"]>;

  return {
    customers: response.data.map(toCustomer),
    currentPage: Number(meta.current_page ?? params.page),
    lastPage: Number(meta.last_page ?? 1),
    total: Number(meta.total ?? 0),
    summary: {
      total: Number(summary.total ?? 0),
      eligible: Number(summary.eligible ?? 0),
      notEligible: Number(summary.notEligible ?? 0),
    },
  };
}

export async function getSelfDriveCustomer(id: number): Promise<SelfDriveCustomer> {
  const response = await apiGet<BackendSelfDriveCustomer>(`/admin/self-drive-verification/customers/${id}`);
  return toCustomer(response.data);
}

export async function approveVerification(record: VerificationRecord) {
  const response = await apiPost<BackendVerificationRecord>(`/admin/document-verification/${record.backendId}/approve`);

  return toVerificationRecord(response.data);
}

export async function rejectVerification(record: VerificationRecord, rejectionReason: string) {
  const response = await apiPost<BackendVerificationRecord>(
    `/admin/document-verification/${record.backendId}/reject`,
    {
      rejection_reason: rejectionReason,
    },
  );

  return toVerificationRecord(response.data);
}
