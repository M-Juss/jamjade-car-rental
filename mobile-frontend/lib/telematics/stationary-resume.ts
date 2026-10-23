import type { CalibrationAccumulator } from './calibration';
import type { MobileTelematicsHandover } from '../../services/api/telematics.service';

export type StationaryResumeSettings = Pick<MobileTelematicsHandover['calibration'], 'captureSeconds' | 'stationaryLimits' | 'completionLimits' | 'profile'>;
export type StationaryResumeSummary = Pick<ReturnType<CalibrationAccumulator['summary']>,
  'sample_count' | 'sensor_duration_ms' | 'max_gap_ms' | 'linear_rms' | 'rotation_peak' | 'max_tilt_degrees'
  | 'yaw_left_degrees' | 'yaw_right_degrees' | 'gravity_x' | 'gravity_y' | 'gravity_z'> & { started_at: string; ended_at: string };

export function stationaryResumeSettingsValid(settings: StationaryResumeSettings) {
  const seconds = settings.captureSeconds.stationary_calibration;
  const { stationaryLimits: limits, completionLimits: quality } = settings;
  return Number.isFinite(seconds) && seconds >= 3 && seconds <= 30
    && Object.values(limits).every((value) => Number.isFinite(value) && value > 0)
    && Number.isFinite(quality.minimumCoverage) && quality.minimumCoverage > 0 && quality.minimumCoverage <= 1
    && Number.isFinite(quality.minimumSamplesPerSecond) && quality.minimumSamplesPerSecond > 0 && quality.minimumSamplesPerSecond <= 30;
}

// Local resume readiness only. Never substitutes for Laravel's setup evaluation.
export function stationaryResumeFailure(summary: StationaryResumeSummary, settings: StationaryResumeSettings): string | null {
  if (!stationaryResumeSettingsValid(settings)) return 'Check settings are unavailable. Close and try again.';
  const values = Object.entries(summary).filter(([key]) => !key.endsWith('_at')).map(([, value]) => value);
  const duration = Date.parse(summary.ended_at) - Date.parse(summary.started_at);
  const expected = settings.captureSeconds.stationary_calibration * 1000;
  const { stationaryLimits: limits, completionLimits: quality } = settings;
  const minimum = expected - 250;
  if (!values.every((value) => typeof value === 'number' && Number.isFinite(value))
    || !Number.isFinite(duration) || duration < minimum || duration > expected + 750
    || !Number.isInteger(summary.sample_count) || summary.sample_count < minimum / 1000 * quality.minimumSamplesPerSecond
    || summary.sample_count > duration / 1000 * 30 + 5
    || summary.sensor_duration_ms < minimum * quality.minimumCoverage || summary.sensor_duration_ms > duration + 250
    || summary.max_gap_ms < 0 || summary.max_gap_ms > limits.maxGapMs) {
    return 'Motion readings were incomplete. Keep the app open and retry while parked.';
  }
  const gravity = Math.hypot(summary.gravity_x, summary.gravity_y, summary.gravity_z);
  if (gravity < 8 || gravity > 12 || summary.linear_rms < 0 || summary.rotation_peak < 0
    || summary.max_tilt_degrees < 0 || summary.yaw_left_degrees < 0 || summary.yaw_right_degrees < 0) {
    return 'Motion readings could not be checked. Keep the phone secured and retry.';
  }
  if (summary.linear_rms > limits.linearRms || summary.rotation_peak > limits.rotationPeak
    || summary.max_tilt_degrees > limits.tiltDegrees || summary.yaw_left_degrees + summary.yaw_right_degrees > limits.yawDegrees) {
    return 'The phone was not steady. Secure it and retry while parked.';
  }
  return null;
}
