import { TABLE_PAGE_SIZE } from "@/lib/table-pagination";
import { apiGet } from "@/services/http";
import { researchQuerySchema, type ResearchQuery } from "@/validations/research/schemas";
import type { ResearchInspection, ResearchRecordingsPage, ResearchTrial } from "./types";

export async function getResearchRecordings(filters: ResearchQuery, signal?: AbortSignal): Promise<ResearchRecordingsPage> {
  const values = researchQuerySchema.parse({ ...filters, per_page: TABLE_PAGE_SIZE });
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  const response = await apiGet<ResearchTrial[]>(`/admin/rc-research/trials?${query}`, { signal, cache: "no-store" });
  return {
    recordings: response.data,
    page: Number(response.meta?.current_page ?? 1),
    lastPage: Number(response.meta?.last_page ?? 1),
    total: Number(response.meta?.total ?? 0),
  };
}

export async function getResearchInspection(id: string, signal?: AbortSignal): Promise<ResearchInspection> {
  return (await apiGet<ResearchInspection>(`/admin/rc-research/trials/${encodeURIComponent(id)}`, { signal, cache: "no-store" })).data;
}
