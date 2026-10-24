import { DeviceMotion } from 'expo-sensors';
import { AppState, Platform } from 'react-native';

import { CalibrationAccumulator, movementCaptureComplete, rotationAxes, type CalibrationReading, type ForwardCalibrationLimits, type MountReference, type MovementCompletion, type Vector3 } from '@/lib/telematics/calibration';

export class CalibrationCaptureAccessError extends Error {
  constructor(readonly hardwareAvailable: boolean) {
    super('Motion access is unavailable. Run device setup again after reviewing device settings.');
  }
}

export async function captureCalibration(seconds: number, reference: MountReference | null, signal: AbortSignal,
  callbacks: { onReady?: () => void; onReading?: (reading: CalibrationReading) => void; forwardLimits?: ForwardCalibrationLimits; completion?: MovementCompletion } = {},
) {
  if (Platform.OS !== 'android') throw new Error('Calibration requires the Android app.');
  if (!Number.isFinite(seconds) || seconds < 3 || seconds > 30) throw new Error('Calibration settings could not be loaded. Refresh and try again.');
  const limits = callbacks.forwardLimits;
  const completion = callbacks.completion;
  if (completion && (!reference || !limits || !Object.values(completion.quality).every(Number.isFinite)
    || completion.quality.minimumDurationMs <= 0 || completion.quality.minimumDurationMs > seconds * 1000
    || completion.quality.minimumCoverage <= 0 || completion.quality.minimumCoverage > 1
    || completion.quality.minimumSamplesPerSecond <= 0 || completion.quality.minimumSamplesPerSecond > 30
    || !Number.isFinite(completion.maxGapMs) || completion.maxGapMs <= 0
    || typeof completion.movement.forwardAccelerationOnly !== 'boolean'
    || ![completion.movement.tiltDegrees, completion.movement.rotationPeak, completion.movement.yawDegrees,
      completion.movement.brakingAcceleration, completion.movement.turnDegrees,
      completion.movement.oppositeTurnDegrees, completion.movement.turnDominance].every(Number.isFinite))) throw new Error('Calibration settings could not be loaded. Refresh and try again.');
  if (limits && (![limits.acceleration, limits.durationMs, limits.coherence, limits.samples].every(Number.isFinite)
    || limits.acceleration <= 0 || limits.acceleration > 100 || limits.durationMs < 0 || limits.durationMs > 1000
    || limits.coherence < 0 || limits.coherence > 1 || !Number.isInteger(limits.samples) || limits.samples < 1 || limits.samples > 40)) throw new Error('Calibration settings could not be loaded. Refresh and try again.');
  const [available, permission] = await Promise.all([DeviceMotion.isAvailableAsync(), DeviceMotion.getPermissionsAsync()]);
  if (!available || !permission.granted) throw new CalibrationCaptureAccessError(available);
  if (signal.aborted || AppState.currentState !== 'active') throw new Error('Calibration paused. Return to this screen and start again while parked.');

  return new Promise<ReturnType<CalibrationAccumulator['summary']> & { started_at: string; ended_at: string }>((resolve, reject) => {
    const accumulator = new CalibrationAccumulator(reference, limits);
    let start: number | null = null;
    let startedAt: string | null = null;
    let lastTimestamp: number | null = null;
    let previous: { timestamp: number; arrival: number } | null = null;
    let steadySince = 0;
    let lastFeedback = -Infinity;
    let finished = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let motionSubscription: ReturnType<typeof DeviceMotion.addListener> | undefined;
    let appSubscription: ReturnType<typeof AppState.addEventListener> | undefined;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      motionSubscription?.remove();
      appSubscription?.remove();
      signal.removeEventListener('abort', cancel);
      if (error) { reject(error); return; }
      const captureStart = start;
      if (captureStart === null || startedAt === null) { reject(new Error('No fresh motion stream was received. Keep the phone secured and try again.')); return; }
      try { resolve({ ...accumulator.summary(performance.now() - captureStart), started_at: startedAt, ended_at: new Date().toISOString() }); }
      catch (failure) { reject(failure); }
    };
    const cancel = () => finish(new Error('Calibration paused. Park safely before starting this step again.'));
    signal.addEventListener('abort', cancel, { once: true });
    appSubscription = AppState.addEventListener('change', (state) => { if (state !== 'active') cancel(); });
    try {
      DeviceMotion.setUpdateInterval(50);
      timer = setTimeout(() => finish(new Error('Motion readings did not stabilize. Keep the phone secured and try again.')), 3000);
      motionSubscription = DeviceMotion.addListener((measurement) => {
        if (finished) return;
        const { acceleration, accelerationIncludingGravity: includingGravity, rotationRate } = measurement;
        if (!acceleration || !rotationRate || !includingGravity) return;
        if (Math.abs(acceleration.timestamp - rotationRate.timestamp) > 0.1 || Math.abs(acceleration.timestamp - includingGravity.timestamp) > 0.1) return;
        if (![acceleration.timestamp, rotationRate.timestamp, includingGravity.timestamp,
          acceleration.x, acceleration.y, acceleration.z, includingGravity.x, includingGravity.y, includingGravity.z,
          rotationRate.alpha, rotationRate.beta, rotationRate.gamma].every(Number.isFinite)) return;
        const arrival = performance.now();
        const linear: Vector3 = [acceleration.x, acceleration.y, acceleration.z];
        const gravity: Vector3 = [includingGravity.x - acceleration.x, includingGravity.y - acceleration.y, includingGravity.z - acceleration.z];
        try {
          if (start === null) {
            // Expo Android retains the last sensor events between subscriptions.
            // Require 200 ms of advancing timestamps that track arrival time;
            // a cached packet or a jump resets startup rather than capture quality.
            const sensorDelta = previous ? (acceleration.timestamp - previous.timestamp) * 1000 : 0;
            const arrivalDelta = previous ? arrival - previous.arrival : 0;
            if (!previous || sensorDelta <= 0 || sensorDelta > 250 || arrivalDelta > 250 || Math.abs(sensorDelta - arrivalDelta) > 100) steadySince = arrival;
            previous = { timestamp: acceleration.timestamp, arrival };
            if (arrival - steadySince < 200) return;
            start = arrival;
            startedAt = new Date().toISOString();
            clearTimeout(timer);
            timer = setTimeout(() => finish(), seconds * 1000);
            callbacks.onReady?.();
          }
          if (finished) return;
          if (lastTimestamp !== null && acceleration.timestamp <= lastTimestamp) return;
          lastTimestamp = acceleration.timestamp;
          const elapsed = arrival - start;
          const rotation = rotationAxes(rotationRate);
          accumulator.add(linear, gravity, rotation, acceleration.timestamp, elapsed);
          if (arrival - lastFeedback >= 200) {
            const summary = accumulator.summary(elapsed);
            const vertical = reference ? linear.reduce((sum, value, index) => sum + value * reference.down[index], 0) : 0;
            callbacks.onReading?.({ elapsedMs: elapsed, durationMs: seconds * 1000,
              acceleration: summary.linear_rms, rotation: summary.rotation_peak,
              tilt: summary.max_tilt_degrees, yaw: summary.yaw_left_degrees + summary.yaw_right_degrees,
              maxGapMs: summary.max_gap_ms,
              ...(reference ? { movement: {
                braking: Math.max(0, -summary.longitudinal_min),
                leftDegrees: summary.yaw_left_degrees, rightDegrees: summary.yaw_right_degrees,
              } } : {}),
              ...(reference && reference.forward === null ? { forward: {
                acceleration: Math.hypot(...linear.map((value, index) => value - vertical * reference.down[index])),
                meanAcceleration: Math.hypot(summary.forward_x, summary.forward_y, summary.forward_z),
                durationMs: summary.forward_duration_ms, coherence: summary.forward_coherence, samples: summary.forward_sample_count,
              } } : {}),
            });
            lastFeedback = arrival;
            if (!finished && completion && reference && limits && movementCaptureComplete(summary, elapsed, reference, completion, limits)) finish();
          }
        }
        catch (error) { finish(error instanceof Error ? error : new Error('Motion capture failed. Repeat this step.')); }
      });
      if (signal.aborted) cancel();
    } catch { finish(new Error('Motion capture could not start. Check motion access and repeat this step.')); }
  });
}
