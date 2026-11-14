import { apiGet } from "@/services/http";

export type AuditEntry = {
  id: string;
  createdAt: string;
  performedBy: string;
  module: string;
  action: string;
  message: string;
  status: "success" | "failed";
};

export type AuditFilters = { search: string; module: string; action: string; status: string };

export async function getAuditLog(filters: AuditFilters, page: number) {
  const query = new URLSearchParams({ ...filters, page: String(page) });
  const response = await apiGet<AuditEntry[]>(`/admin/errors?${query}`);
  return { entries: response.data, total: Number(response.meta?.total ?? 0), lastPage: Number(response.meta?.last_page ?? 1) };
}
