import { z } from "zod";
import { TABLE_PAGE_SIZE } from "@/lib/table-pagination";
import { apiGet } from "@/services/http";
import { nativeResearchQuerySchema, nativeWindowQuerySchema } from "@/validations/research/schemas";
import type { NativeChannel, NativeInspection, NativeRecording, NativeWindow } from "./native-types";

export async function getNativeRecordings(page: number, search: string, signal?: AbortSignal) {
  const values = nativeResearchQuerySchema.parse({ page, search, per_page: TABLE_PAGE_SIZE });
  const query = new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)]));
  const response = await apiGet<NativeRecording[]>(`/admin/rc-research/native-recordings?${query}`, { signal, cache: "no-store" });
  return { recordings: response.data, page: Number(response.meta?.current_page ?? 1), lastPage: Number(response.meta?.last_page ?? 1), total: Number(response.meta?.total ?? 0) };
}

export async function getNativeInspection(id: string, signal?: AbortSignal): Promise<NativeInspection> {
  z.string().uuid().parse(id);
  return (await apiGet<NativeInspection>(`/admin/rc-research/native-recordings/${encodeURIComponent(id)}`, { signal, cache: "no-store" })).data;
}

export async function getNativeWindow(id: string, channel: NativeChannel, start_ms: number, end_ms: number, signal?: AbortSignal): Promise<NativeWindow> {
  z.string().uuid().parse(id);
  const values = nativeWindowQuerySchema.parse({ channel, start_ms, end_ms });
  const query = new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)]));
  return (await apiGet<NativeWindow>(`/admin/rc-research/native-recordings/${encodeURIComponent(id)}/window?${query}`, { signal, cache: "no-store" })).data;
}
