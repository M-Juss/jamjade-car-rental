import type { CalibrationLiveState } from '@/lib/telematics/calibration';
import { stationaryResumeFailure, stationaryResumeSettingsValid, type StationaryResumeSettings } from '@/lib/telematics/stationary-resume';
import { getBookingTelematicsSetup } from '@/services/api/telematics.service';
import { getLocationMonitoring } from '@/services/api/location-monitoring.service';
import { CalibrationCaptureAccessError, captureCalibration } from './calibration-capture';

export class StationaryResumeCheckIssue extends Error {
  constructor(message: string, readonly needsSettings = false) { super(message); }
}

export async function runStationaryResumeCheck(bookingCode: string, signal: AbortSignal,
  onSettings: (settings: StationaryResumeSettings) => void, onLive: (live: CalibrationLiveState) => void,
) {
  const [handover, monitoring] = await Promise.all([
    getBookingTelematicsSetup(bookingCode, signal), getLocationMonitoring(bookingCode, signal),
  ]).catch(() => { throw new Error('Rental status could not be checked. Check your connection and retry.'); });
  if (signal.aborted) return false;
  if (handover.bookingCode !== bookingCode || handover.eligibility.state !== 'released' || !monitoring.canMonitor) {
    throw new Error('Monitoring is no longer available. Refresh this rental.');
  }
  const { captureSeconds, stationaryLimits, completionLimits, profile } = handover.calibration;
  const settings = { captureSeconds, stationaryLimits, completionLimits, profile };
  if (!stationaryResumeSettingsValid(settings)) throw new Error('Check settings are unavailable. Close and try again.');
  onSettings(settings);
  onLive({ step: 'stationary_calibration', phase: 'preparing' });
  // Start check explicitly allows a foreground stability check, without modifying setup.
  const summary = await captureCalibration(settings.captureSeconds.stationary_calibration, null, signal, {
    stationaryWindow: { limits: stationaryLimits, accepts: (candidate) => stationaryResumeFailure(candidate, settings) === null },
    onReading: (reading) => { if (!signal.aborted) onLive({ step: 'stationary_calibration', phase: 'recording', reading }); },
  }).catch((failure: unknown) => {
    if (failure instanceof CalibrationCaptureAccessError) {
      throw new StationaryResumeCheckIssue(failure.hardwareAvailable
        ? 'Allow motion access in device Settings, then retry.'
        : 'Motion sensors are unavailable on this phone. The check cannot run.', failure.hardwareAvailable);
    }
    throw failure;
  });
  if (signal.aborted) return false;
  onLive({ step: 'stationary_calibration', phase: 'evaluating' });
  const failure = stationaryResumeFailure(summary, settings);
  if (failure) throw new Error(failure);
  const current = await getLocationMonitoring(bookingCode, signal)
    .catch(() => { throw new Error('Rental status could not be checked. Check your connection and retry.'); });
  if (signal.aborted) return false;
  if (!current.canMonitor) throw new Error('Monitoring is no longer available. Refresh this rental.');
  onLive({ step: 'stationary_calibration', phase: 'passed' });
  return true;
}
