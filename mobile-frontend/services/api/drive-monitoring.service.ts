import { apiGet, apiPost } from '@/services/http';
import { driveMonitoringBatchSchema, driveMonitoringWindowsSchema, driveMonitoringReferenceQuerySchema, startDriveMonitoringSchema, type DriveMonitoringBatch, type DriveMonitoringWindows, type StartDriveMonitoring } from '@/validation/research/drive-monitoring';

export type DriveReference = { rotation_rfu: number[][]; acceleration_mean: number[]; gyroscope_mean: number[] };
export async function getDriveMonitoringReference(researchSessionId: string, mountVersionId: string) {
  const query = driveMonitoringReferenceQuerySchema.parse({ research_session_id: researchSessionId, mount_version_id: mountVersionId });
  return (await apiGet<{ reference_run_id: string; reference: DriveReference }>(
    `/mobile/rc-research/drive-monitoring/reference?${new URLSearchParams(query)}`)).data;
}

export type DriveMonitoringSession = {
  id: string;
  client_session_id: string;
  reference_run_id: string;
  research_session_id: string;
  mount_version_id: string;
  runtime_reference: DriveReference;
  status: 'active' | 'stopped';
  analyzed_through_ms: number;
  model_sha256: string;
  created_at: string;
  ended_at: string | null;
};

export async function openDriveMonitoringSession(input: StartDriveMonitoring): Promise<DriveMonitoringSession> {
  const response = await apiPost<DriveMonitoringSession>('/mobile/rc-research/drive-monitoring/sessions',
    startDriveMonitoringSchema.parse(input));
  return response.data;
}

export async function stopDriveMonitoringSession(id: string): Promise<DriveMonitoringSession> {
  const response = await apiPost<DriveMonitoringSession>(
    `/mobile/rc-research/drive-monitoring/sessions/${encodeURIComponent(id)}/stop`, {});
  return response.data;
}

export type DriveMonitoringPrediction = {
  id: string;
  class: 'normal_motion' | 'harsh_acceleration' | 'harsh_braking' | 'harsh_cornering' |
    'lane_change' | 'normal_swerve' | 'harsh_swerve';
  vote: number;
};

type PredictionBatch = {
  version: 'rc-demo-inference-v1';
  model_sha256: string;
  predictions: DriveMonitoringPrediction[];
};

export async function deliverDriveMonitoringBatch(sessionId: string, input: DriveMonitoringBatch): Promise<PredictionBatch> {
  const response = await apiPost<PredictionBatch>(
    `/mobile/rc-research/drive-monitoring/sessions/${encodeURIComponent(sessionId)}/batches`,
    driveMonitoringBatchSchema.parse(input));
  return response.data;
}

export async function classifyDriveMonitoringWindows(input: DriveMonitoringWindows): Promise<PredictionBatch> {
  const payload = driveMonitoringWindowsSchema.parse(input);
  const response = await apiPost<PredictionBatch>('/mobile/rc-research/drive-monitoring/inference', payload);
  return response.data;
}
