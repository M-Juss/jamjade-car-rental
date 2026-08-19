import { apiGet, apiPost, resolveAssetUrl } from "@/services/http";
import type {
  BackendVerificationRecord,
  DocumentType,
  FileType,
  VerificationRecord,
  VerificationStatus,
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

export async function getVerificationRecords() {
  const response = await apiGet<BackendVerificationRecord[]>("/admin/document-verification?per_page=100");

  return response.data.map(toVerificationRecord);
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
