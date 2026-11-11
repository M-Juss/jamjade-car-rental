import { apiGet } from "@/services/http";

export type MonitoringSession = {
  id: string;
  status: "active" | "stopped";
  analyzed_through_ms: number;
  created_at: string;
  ended_at: string | null;
  reference_run_id: string;
  research_session_number?: number | null;
  model_sha256: string;
};

export function getMonitoringSessions(page: number, signal?: AbortSignal) {
  return apiGet<MonitoringSession[]>(`/admin/rc-research/drive-monitoring/sessions?page=${page}&per_page=10`, { signal });
}

export type MonitoringSessionDetail = {
    session: MonitoringSession;
    received_batches: number;
    latest_received_at: string | null;
    event_summary: { detected: number; needs_review: number; pending: number };
    events: { id: string; target: string; status: 'confirmed' | 'review_required'; start_ms: number; end_ms: number; vote: number; received_at: string }[];
    recent_predictions: {
      batch_id: string;
      received_at: string;
      predictions: { id: string; class: string; vote: number }[];
    }[];
};

export function getMonitoringSession(id: string, signal?: AbortSignal) {
  return apiGet<MonitoringSessionDetail>(`/admin/rc-research/drive-monitoring/sessions/${encodeURIComponent(id)}`, { signal });
}
