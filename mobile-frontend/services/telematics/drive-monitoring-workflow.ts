import module from '@/modules/rc-recorder';
import { nativeRecorder, NativeRecorderError } from './native-recorder';
import { connectDriveMonitoringTransfer, getDriveMonitoringTransferStatus } from './drive-monitoring-transfer';
import { getDriveMonitoringReference, openDriveMonitoringSession, stopDriveMonitoringSession } from '@/services/api/drive-monitoring.service';
import type { NativeRecordingInput } from '@/validation/research/native-recorder';
import { ApiError } from '@/services/http';

export async function startDriveMonitoring(ownerId: number, values: NativeRecordingInput, researchSessionId: string, mountVersionId: string) {
  if (!module?.driveStartIdentity || !module.startDriveMonitoring) throw new NativeRecorderError('Install the updated JamJade APK for Drive Monitoring.');
  await nativeRecorder.authorize(ownerId);
  const transfer = await getDriveMonitoringTransferStatus();
  if (transfer.unfinished_sessions.length || transfer.finishing) throw new NativeRecorderError('Finish the pending monitoring transfer first.');
  const selected = await getDriveMonitoringReference(researchSessionId, mountVersionId).catch(failure => {
    if (failure instanceof ApiError && [404, 422].includes(failure.status))
      throw new NativeRecorderError('Upload and prepare a 5 Hz forward reference for this session and mount first.');
    throw failure;
  });
  const context = { research_session_id: researchSessionId, mount_version_id: mountVersionId, reference_run_id: selected.reference_run_id };
  const clientSessionId = await module.driveStartIdentity(JSON.stringify(context));
  // A lost response keeps the same durable client identity for the next explicit attempt.
  const session = await openDriveMonitoringSession({ ...context, client_session_id: clientSessionId,
    consent_version: 'drive-monitoring-v1', consent: true, same_mount_confirmed: true });
  if (session.status !== 'active') {
    await module.clearDriveStartIdentity?.();
    throw new NativeRecorderError('The previous monitoring session has finished. Start again.');
  }
  try {
    await nativeRecorder.start(ownerId, values, { session_id: session.id,
      research_session_id: researchSessionId, mount_version_id: mountVersionId, reference: session.runtime_reference });
    for (let attempt = 0; attempt < 50; attempt++) {
      const state = await nativeRecorder.status();
      if (state.active && !state.preparing) {
        await connectDriveMonitoringTransfer(session.id);
        return session;
      }
      if (state.error) throw new Error(state.error);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Monitoring sensors did not start.');
  } catch (failure) {
    await nativeRecorder.stop();
    // Stop the server only if no pending windows need delivery. Otherwise recovery owns it.
    const status = await getDriveMonitoringTransferStatus();
    if (!status.pending_batches) {
      await stopDriveMonitoringSession(session.id);
      await module.clearDriveStartIdentity?.();
    }
    throw failure;
  }
}

export async function recoverDriveMonitoringTransfer(ownerId: number, sessionId: string) {
  await nativeRecorder.authorize(ownerId);
  await connectDriveMonitoringTransfer(sessionId);
}
