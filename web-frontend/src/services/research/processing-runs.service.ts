import { z } from "zod";
import { TABLE_PAGE_SIZE } from "@/lib/table-pagination";
import { apiGet, apiPost } from "@/services/http";
import { processingRequestSchema, type ProcessingRequestValues } from "@/validations/research/processing-run";
import type { ProcessingDetail, ProcessingRun, ReferenceRunOption } from "./processing-types";

const path = (recordingId: string) => {
  z.string().uuid().parse(recordingId);
  return `/admin/rc-research/native-recordings/${encodeURIComponent(recordingId)}/processing-runs`;
};
export async function saveProcessingRun(recordingId: string, values: ProcessingRequestValues) {
  return (await apiPost<ProcessingDetail>(path(recordingId), processingRequestSchema.parse(values))).data;
}
export async function getReferenceRuns(recordingId: string, page: number, signal?: AbortSignal) {
  z.string().uuid().parse(recordingId); z.number().int().min(1).parse(page);
  const response = await apiGet<ReferenceRunOption[]>(`/admin/rc-research/native-recordings/${encodeURIComponent(recordingId)}/reference-runs?page=${page}&per_page=${TABLE_PAGE_SIZE}`, { signal, cache: "no-store" });
  return { references: response.data, page: Number(response.meta?.current_page ?? 1), lastPage: Number(response.meta?.last_page ?? 1), total: Number(response.meta?.total ?? 0) };
}
export async function getProcessingRuns(recordingId: string, page: number, signal?: AbortSignal) {
  z.number().int().min(1).parse(page);
  const response = await apiGet<ProcessingRun[]>(`${path(recordingId)}?page=${page}&per_page=${TABLE_PAGE_SIZE}`, { signal, cache: "no-store" });
  return { runs: response.data, page: Number(response.meta?.current_page ?? 1), lastPage: Number(response.meta?.last_page ?? 1), total: Number(response.meta?.total ?? 0) };
}
export async function getProcessingRun(recordingId: string, runId: string, signal?: AbortSignal) {
  z.string().uuid().parse(runId);
  return (await apiGet<ProcessingDetail>(`${path(recordingId)}/${encodeURIComponent(runId)}`, { signal, cache: "no-store" })).data;
}
