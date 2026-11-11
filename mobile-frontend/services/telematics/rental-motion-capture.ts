import { AppState } from 'react-native';

import { CalibrationAccumulator, movementCaptureComplete, stationaryWithinRange, type CalibrationReading, type Vector3 } from '@/lib/telematics/calibration';
import nativeRecorder from '@/modules/rc-recorder';
import type { MobileTelematicsHandover } from '@/services/api';

type Settings = MobileTelematicsHandover['calibration'];
type Summary = ReturnType<CalibrationAccumulator['summary']>;
type Batch = {
  wallMs: number;
  clockMs: number;
  rows: [number, number, number, number, number, number, number, number, number, number][];
};

const pauseError = () => new Error('Calibration paused. Park safely before starting this step again.');
const degreesPerRadian = 180 / Math.PI;
const stationaryCaptureSeconds = 30;
const settleMs = 300;
const feedbackIntervalMs = 200;

export async function captureRentalMotion(
  step: 'stationary_calibration' | 'forward_calibration', settings: Settings, signal: AbortSignal,
  onReady: () => void, onReading: (reading: CalibrationReading) => void,
) {
  if (!nativeRecorder?.beginRentalMotion || !nativeRecorder.readRentalMotion || !nativeRecorder.cancelRentalMotion) {
    throw new Error('Update JamJade to use native motion calibration.');
  }
  const recorder = nativeRecorder;
  const seconds = settings.captureSeconds[step];
  const forward = step === 'forward_calibration';
  const reference = forward ? settings.reference : null;
  const parked = forward ? settings.parkedAcceleration : null;
  if (!Number.isInteger(seconds) || seconds < 3 || seconds > 30) throw new Error('Calibration settings are unavailable. Refresh and try again.');
  if (forward && (!reference || reference.forward !== null || !parked?.every(Number.isFinite))) {
    throw new Error('Repeat the stationary capture to restore the parked reference.');
  }
  if (signal.aborted || AppState.currentState !== 'active') throw pauseError();

  const createAccumulator = () => new CalibrationAccumulator(reference, settings.forwardLimits, 2000, true);
  let accumulator = createAccumulator();
  const durationMs = seconds * 1000;
  const { stationaryLimits, completionLimits, forwardLimits, movementLimits } = settings;
  let id: string | undefined;
  let interrupted = false;
  const cancel = () => {
    interrupted = true;
    if (id) void recorder.cancelRentalMotion?.(id).catch(() => undefined);
  };
  const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') cancel(); });
  signal.addEventListener('abort', cancel, { once: true });
  const ensureActive = () => {
    if (interrupted || signal.aborted || AppState.currentState !== 'active') throw pauseError();
  };
  let steadySince: number | null = null;
  let previous: number | null = null;
  let origin: number | null = null;
  let lastFeedback = -Infinity;
  let stationaryStarted = false;
  let latestStationaryReading: CalibrationReading | undefined;
  let forwardReady = false;
  let forwardStarted = false;
  let lastValidForwardMs = 0;
  let retryingForward = false;
  const resetStationary = () => {
    steadySince = null;
    if (origin !== null) accumulator = createAccumulator();
    origin = null;
  };
  const evidence = (summary: Summary, wallMs: number, originMs: number, elapsed: number) => ({
    ...summary,
    started_at: new Date(wallMs + originMs).toISOString(),
    ended_at: new Date(wallMs + originMs + elapsed).toISOString(),
  });
  try {
    ensureActive();
    id = await nativeRecorder.beginRentalMotion(forward ? 0 : stationaryCaptureSeconds);
    while (true) {
      ensureActive();
      const batch = JSON.parse(await nativeRecorder.readRentalMotion(id)) as Batch;
      ensureActive();
      for (const [ms, ax, ay, az, gx, gy, gz, ux, uy, uz] of batch.rows) {
        const up: Vector3 = [ux, uy, uz];
        if (Math.hypot(...up) < 8 || Math.hypot(...up) > 12) {
          if (!forward) resetStationary();
          continue;
        }
        if (forward) {
          lastValidForwardMs = ms;
          if (!forwardStarted) {
            forwardStarted = true;
            onReady();
            ensureActive();
          }
        }
        const gravity: Vector3 = [-ux, -uy, -uz];
        const linear: Vector3 = [ax - (parked?.[0] ?? ux), ay - (parked?.[1] ?? uy), az - (parked?.[2] ?? uz)];
        const rotation: Vector3 = [gx * degreesPerRadian, gy * degreesPerRadian, gz * degreesPerRadian];
        if (!forward) {
          const acceleration = Math.hypot(...linear);
          const rotationRate = Math.hypot(...rotation);
          const gap = previous === null ? 0 : ms - previous;
          previous = ms;
          const hadWindow = origin !== null;
          if (gap > stationaryLimits.maxGapMs) resetStationary();

          // Require the same short settling period after each interrupted window.
          if (origin === null) {
            if (acceleration > stationaryLimits.linearRms || rotationRate > stationaryLimits.rotationPeak) {
              steadySince = null;
            } else {
              if (steadySince === null || gap > 60) steadySince = ms;
              if (ms - steadySince >= settleMs) origin = ms;
            }
          }

          let reading: CalibrationReading = {
            elapsedMs: 0, durationMs, acceleration, rotation: rotationRate, tilt: 0, yaw: 0, maxGapMs: gap,
          };
          if (origin !== null) {
            const elapsed = ms - origin;
            accumulator.add(linear, gravity, rotation, elapsed / 1000, elapsed);
            const summary = accumulator.summary(elapsed);
            const windowReading = {
              ...reading, elapsedMs: elapsed, acceleration: summary.linear_rms, rotation: summary.rotation_peak,
              tilt: summary.max_tilt_degrees, yaw: summary.yaw_left_degrees + summary.yaw_right_degrees,
              maxGapMs: summary.max_gap_ms,
            };
            if (!stationaryWithinRange(windowReading, stationaryLimits)) resetStationary();
            reading = { ...windowReading, elapsedMs: origin === null ? 0 : elapsed, rotation: rotationRate };
            if (origin !== null && elapsed >= durationMs) {
              ensureActive();
              onReading(reading);
              return evidence(summary, batch.wallMs, origin, elapsed);
            }
          }

          if (!stationaryStarted) {
            stationaryStarted = true;
            onReady();
            ensureActive();
          }
          latestStationaryReading = reading;
          if (ms - lastFeedback >= feedbackIntervalMs || (hadWindow && origin === null)) {
            lastFeedback = ms;
            onReading(reading);
          }
          continue;
        }
        const gap = previous === null ? 0 : ms - previous;
        previous = ms;
        const moving = Math.hypot(...linear) > stationaryLimits.linearRms || Math.hypot(...rotation) > stationaryLimits.rotationPeak;
        if (origin !== null && (ms - origin > durationMs || gap > stationaryLimits.maxGapMs)) {
          origin = null;
          steadySince = null;
          forwardReady = false;
          retryingForward = true;
        }
        if (origin === null) {
          if (gap > 60) forwardReady = false;
          if (moving) steadySince = null;
          else if (steadySince === null || gap > 60) steadySince = ms;
          if (steadySince !== null && ms - steadySince >= (retryingForward ? 1000 : settleMs)) {
            forwardReady = true;
            retryingForward = false;
          }
          if (!forwardReady || !moving) {
            if (forwardStarted && ms - lastFeedback >= feedbackIntervalMs) {
              lastFeedback = ms;
              onReading({
                forwardStatus: forwardReady ? 'ready' : 'retry',
                elapsedMs: 0, durationMs, acceleration: Math.hypot(...linear), rotation: Math.hypot(...rotation),
                tilt: 0, yaw: 0, maxGapMs: gap,
              });
            }
            continue;
          }
          accumulator = createAccumulator();
          origin = ms;
          lastFeedback = -Infinity;
        }
        const elapsed = ms - origin;
        accumulator.add(linear, gravity, rotation, elapsed / 1000, elapsed);
        if (ms - lastFeedback < feedbackIntervalMs && elapsed < durationMs) continue;
        lastFeedback = ms;
        const summary = accumulator.summary(elapsed);
        const vertical = reference ? linear.reduce((sum, value, index) => sum + value * reference.down[index], 0) : 0;
        onReading({
          forwardStatus: 'measuring',
          elapsedMs: elapsed, durationMs, acceleration: summary.linear_rms, rotation: summary.rotation_peak,
          tilt: summary.max_tilt_degrees, yaw: summary.yaw_left_degrees + summary.yaw_right_degrees, maxGapMs: summary.max_gap_ms,
          ...(reference ? { forward: {
            acceleration: Math.hypot(...linear.map((value, index) => value - vertical * reference.down[index])),
            meanAcceleration: Math.hypot(summary.forward_x, summary.forward_y, summary.forward_z),
            durationMs: summary.forward_duration_ms, coherence: summary.forward_coherence, samples: summary.forward_sample_count,
          } } : {}),
        });
        if (reference && movementCaptureComplete(summary, elapsed, reference, {
          step: 'forward_calibration', quality: completionLimits, movement: movementLimits, maxGapMs: stationaryLimits.maxGapMs,
        }, forwardLimits, 50)) {
          ensureActive();
          return evidence(summary, batch.wallMs, origin, elapsed);
        }
      }
      if (forward && batch.clockMs - lastValidForwardMs > 3000) {
        throw new Error('Motion readings stopped. Keep the app open and retry while parked.');
      }
      if (!forward) {
        if (previous !== null && batch.clockMs - previous > stationaryLimits.maxGapMs && (origin !== null || steadySince !== null)) {
          resetStationary();
          if (latestStationaryReading) {
            onReading({ ...latestStationaryReading, elapsedMs: 0, maxGapMs: batch.clockMs - previous });
          }
        }
        if (batch.clockMs >= Math.max(stationaryCaptureSeconds * 1000, durationMs + 3000)) {
          throw new Error('The phone did not stay steady long enough. Secure it, keep the vehicle parked, and retry.');
        }
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }
  } finally {
    subscription.remove();
    signal.removeEventListener('abort', cancel);
    if (id) await nativeRecorder.cancelRentalMotion(id).catch(() => undefined);
  }
}
