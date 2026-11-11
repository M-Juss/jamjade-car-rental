import nativeRecorder from '@/modules/rc-recorder';
import { API_BASE_URL } from '@/services/http/config';
import { getApiAuthToken } from '@/services/http/auth-token';
import { driveMonitoringBatchSchema, type DriveMonitoringBatch } from '@/validation/research/drive-monitoring';

export type DriveTransferStatus = {
  state: 'stopped' | 'waiting' | 'sending' | 'access_required' | 'review_required' | 'storage_error' | 'retrying';
  session_id: string | null;
  finishing: boolean;
  pending_batches: number;
  unfinished_sessions: string[];
};

export async function connectDriveMonitoringTransfer(sessionId: string): Promise<void> {
  if (!nativeRecorder?.configureDriveUpload) {
    throw new Error('Update JamJade to enable monitoring transfer.');
  }
  const token = await getApiAuthToken();
  if (!token) throw new Error('Sign in again to connect monitoring.');
  const apiUrl = new URL(
    `${API_BASE_URL}/mobile/rc-research/drive-monitoring/sessions/${encodeURIComponent(sessionId)}/batches`,
  );
  if (apiUrl.protocol !== 'https:') {
    throw new Error('Monitoring transfer requires a secure backend connection.');
  }
  await nativeRecorder.configureDriveUpload(JSON.stringify({ session_id: sessionId, api_url: apiUrl.toString(), token }));
}

export async function queueDriveMonitoringBatch(sessionId: string, input: DriveMonitoringBatch): Promise<void> {
  if (!nativeRecorder?.enqueueDriveBatch) {
    throw new Error('Update JamJade to queue monitoring readings.');
  }
  const payload = driveMonitoringBatchSchema.parse(input);
  await nativeRecorder.enqueueDriveBatch(JSON.stringify({ session_id: sessionId, payload }));
}

export async function getDriveMonitoringTransferStatus(): Promise<DriveTransferStatus> {
  if (!nativeRecorder?.driveUploadStatus) return { state: 'stopped', session_id: null, finishing: false, pending_batches: 0, unfinished_sessions: [] };
  return JSON.parse(await nativeRecorder.driveUploadStatus()) as DriveTransferStatus;
}
