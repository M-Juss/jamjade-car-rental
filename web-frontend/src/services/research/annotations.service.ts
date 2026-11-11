import { z } from "zod";
import { apiGet, apiPost } from "@/services/http";
import { TABLE_PAGE_SIZE } from "@/lib/table-pagination";
import { annotationRevisionSchema, type AnnotationInterval, type AnnotationValues } from "@/validations/research/annotations";

export type AnnotationRevision = { id: string; revision: number; state: "unlabeled" | "reviewed" | "uncertain";
  created_at: string; version: string; manifest_sha256: string; intervals: AnnotationInterval[]; effective_intervals?: AnnotationInterval[] };
const path = (recording: string) => {
  z.string().uuid().parse(recording);
  return `/admin/rc-research/native-recordings/${encodeURIComponent(recording)}/annotations`;
};
export async function getAnnotations(recording: string, signal?: AbortSignal) {
  return (await apiGet<AnnotationRevision | null>(path(recording), { signal, cache: "no-store" })).data;
}
export async function saveAnnotations(recording: string, values: AnnotationValues) {
  return (await apiPost<AnnotationRevision>(path(recording), annotationRevisionSchema.parse(values))).data;
}
export async function getAnnotationHistory(recording: string, page: number, signal?: AbortSignal) {
  z.number().int().min(1).parse(page);
  const r = await apiGet<Omit<AnnotationRevision, "intervals" | "effective_intervals">[]>(`${path(recording)}/history?page=${page}&per_page=${TABLE_PAGE_SIZE}`, { signal, cache: "no-store" });
  return { revisions: r.data, page: Number(r.meta?.current_page ?? 1), lastPage: Number(r.meta?.last_page ?? 1), total: Number(r.meta?.total ?? 0) };
}
export async function getAnnotationRevision(recording: string, id: string, signal?: AbortSignal) {
  z.string().uuid().parse(id);
  return (await apiGet<AnnotationRevision>(`${path(recording)}/${encodeURIComponent(id)}`, { signal, cache: "no-store" })).data;
}
