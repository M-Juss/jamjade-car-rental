import type { MobileTelematicsHandover } from '@/services/api/telematics.service';

export const CALIBRATION_STEPS = {
  stationary_calibration: { title: 'Keep the vehicle parked', guidance: 'Keep the mounted phone still while we record its reference position.' },
  forward_calibration: { title: 'Forward movement', guidance: 'When staff directs you, move forward gently in a straight line, then stop safely.' },
  braking_calibration: { title: 'Gentle braking', guidance: 'When staff directs you, move forward slowly, then brake gently to a stop. Do not brake suddenly.' },
  left_turn_calibration: { title: 'Left turn', guidance: 'When staff directs you, make a gentle left turn at low speed, then stop safely.' },
  right_turn_calibration: { title: 'Right turn', guidance: 'When staff directs you, make a gentle right turn at low speed, then stop safely.' },
} as const;

export type CalibrationStep = keyof typeof CALIBRATION_STEPS;
export type Vector3 = [number, number, number];
export type MountReference = NonNullable<MobileTelematicsHandover['calibration']['reference']>;
export type ForwardCalibrationLimits = MobileTelematicsHandover['calibration']['forwardLimits'];
export type MovementCompletion = {
  step: Exclude<CalibrationStep, 'stationary_calibration'>;
  quality: MobileTelematicsHandover['calibration']['completionLimits'];
  movement: MobileTelematicsHandover['calibration']['movementLimits'];
  maxGapMs: number;
};
export type CalibrationReading = {
  forwardStatus?: 'ready' | 'measuring' | 'retry';
  elapsedMs: number;
  durationMs: number;
  acceleration: number;
  rotation: number;
  tilt: number;
  yaw: number;
  maxGapMs: number;
  forward?: { acceleration: number; meanAcceleration: number; durationMs: number; coherence: number; samples: number };
  movement?: { braking: number; leftDegrees: number; rightDegrees: number };
};
export type CalibrationLiveState = {
  step: CalibrationStep;
  phase: 'preparing' | 'recording' | 'evaluating' | 'passed' | 'failed';
  reading?: CalibrationReading;
};

export function stationaryWithinRange(reading: CalibrationReading, limits: MobileTelematicsHandover['calibration']['stationaryLimits']) {
  return reading.acceleration <= limits.linearRms && reading.rotation <= limits.rotationPeak
    && reading.tilt <= limits.tiltDegrees && reading.yaw <= limits.yawDegrees && reading.maxGapMs <= limits.maxGapMs;
}

export function forwardMotionFeedback(reading: CalibrationReading | undefined, limits: MobileTelematicsHandover['calibration']['forwardLimits'], mountLimits: MobileTelematicsHandover['calibration']['stationaryLimits'], stale = false, movementLimits?: MobileTelematicsHandover['calibration']['movementLimits']) {
  if (stale || reading && reading.maxGapMs > mountLimits.maxGapMs) return { state: 'interrupted', progress: 0 } as const;
  if (!reading?.forward) return { state: 'waiting', progress: 0 } as const;
  if (reading.tilt > mountLimits.tiltDegrees) return { state: 'mount_moved', progress: 0 } as const;
  const rotationLimit = movementLimits?.rotationPeak ?? mountLimits.rotationPeak;
  const yawLimit = movementLimits?.yawDegrees ?? mountLimits.yawDegrees;
  const accelerationOnly = movementLimits?.forwardAccelerationOnly ?? false;
  if (!accelerationOnly && (reading.rotation > rotationLimit || reading.yaw > yawLimit)) return { state: 'turning', progress: 0 } as const;
  const movement = reading.forward;
  const progress = limits.durationMs === 0 ? (movement.samples >= limits.samples ? 1 : 0) : Math.min(1, movement.durationMs / limits.durationMs);
  if (progress >= 1 && (movement.coherence < limits.coherence || movement.meanAcceleration < limits.acceleration)) return { state: 'inconsistent', progress: 0 } as const;
  if (progress >= 1 && movement.samples >= limits.samples) return { state: 'captured', progress: 1 } as const;
  return movement.acceleration >= limits.acceleration || movement.durationMs > 0
    ? { state: 'building', progress: Math.min(0.95, progress) } as const : { state: 'waiting', progress: 0 } as const;
}

export function isCalibrationStep(value: string | null): value is 'stationary_calibration' | 'forward_calibration' {
  // Legacy exercise names remain readable, but cannot start new rental captures.
  return value === 'stationary_calibration' || value === 'forward_calibration';
}

export function rcMovementFeedback(step: CalibrationStep, reading: CalibrationReading | undefined,
  limits: MobileTelematicsHandover['calibration']['movementLimits'], forwardLimits: ForwardCalibrationLimits, maxGapMs: number, stale = false,
) {
  if (stale || reading && reading.maxGapMs > maxGapMs) return 'interrupted';
  if (!reading) return 'waiting';
  if (reading.tilt > limits.tiltDegrees) return 'position_changed';
  if (step === 'forward_calibration') {
    if (!limits.forwardAccelerationOnly && (reading.rotation > limits.rotationPeak || reading.yaw > limits.yawDegrees)) return 'keep_straight';
    const forward = reading.forward;
    return forward && forward.durationMs >= forwardLimits.durationMs && forward.samples >= forwardLimits.samples
      && forward.meanAcceleration >= forwardLimits.acceleration && forward.coherence >= forwardLimits.coherence ? 'captured' : 'waiting';
  }
  if (!reading.movement) return 'waiting';
  if (step === 'braking_calibration') return reading.movement.braking >= limits.brakingAcceleration ? 'captured' : 'waiting';
  const expected = step === 'left_turn_calibration' ? reading.movement.leftDegrees : reading.movement.rightDegrees;
  const opposite = step === 'left_turn_calibration' ? reading.movement.rightDegrees : reading.movement.leftDegrees;
  return expected >= limits.turnDegrees && opposite <= limits.oppositeTurnDegrees && expected >= opposite * limits.turnDominance ? 'captured' : 'waiting';
}

const dot = (a: Vector3, b: Vector3) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const magnitude = (a: Vector3) => Math.sqrt(dot(a, a));
const unit = (a: Vector3): Vector3 => a.map((value) => value / magnitude(a)) as Vector3;

// This ends native capture only. Laravel still evaluates the complete summary.
export function movementCaptureComplete(summary: ReturnType<CalibrationAccumulator['summary']>, elapsedMs: number,
  reference: MountReference, policy: MovementCompletion, forwardLimits: ForwardCalibrationLimits, sampleRate = 30,
) {
  const { quality, movement, step } = policy;
  if (elapsedMs < quality.minimumDurationMs || summary.sensor_duration_ms < elapsedMs * quality.minimumCoverage
    || summary.sensor_duration_ms > elapsedMs + 250 || summary.sample_count < elapsedMs / 1000 * quality.minimumSamplesPerSecond
    || summary.sample_count > elapsedMs / 1000 * sampleRate + 5 || summary.max_gap_ms > policy.maxGapMs) return false;
  const gravity: Vector3 = [summary.gravity_x, summary.gravity_y, summary.gravity_z];
  const norm = magnitude(gravity);
  const meanTilt = Math.acos(Math.max(-1, Math.min(1, dot(unit(gravity), reference.down)))) * 180 / Math.PI;
  if (norm < 8 || norm > 12 || meanTilt > movement.tiltDegrees) return false;
  const forward: Vector3 = [summary.forward_x, summary.forward_y, summary.forward_z];
  if (step === 'forward_calibration' && (summary.forward_duration_ms > summary.sensor_duration_ms
    || summary.forward_sample_count > summary.sample_count
    || summary.forward_sample_count > summary.forward_duration_ms / 1000 * sampleRate + 2
    || Math.abs(dot(forward, reference.down)) > magnitude(forward) * 0.05)) return false;
  return rcMovementFeedback(step, {
    elapsedMs, durationMs: elapsedMs, acceleration: summary.linear_rms, rotation: summary.rotation_peak,
    tilt: summary.max_tilt_degrees, yaw: summary.yaw_left_degrees + summary.yaw_right_degrees, maxGapMs: summary.max_gap_ms,
    forward: { acceleration: 0, meanAcceleration: magnitude(forward), durationMs: summary.forward_duration_ms,
      coherence: summary.forward_coherence, samples: summary.forward_sample_count },
    movement: { braking: Math.max(0, -summary.longitudinal_min), leftDegrees: summary.yaw_left_degrees, rightDegrees: summary.yaw_right_degrees },
  }, movement, forwardLimits, policy.maxGapMs) === 'captured';
}

// Expo Sensors 15.0.8 Android maps gyroscope x/y/z to alpha/beta/gamma.
export function rotationAxes(rate: { alpha: number; beta: number; gamma: number }): Vector3 {
  return [rate.alpha, rate.beta, rate.gamma];
}

export class CalibrationAccumulator {
  private count = 0;
  private gravitySum: Vector3 = [0, 0, 0];
  private squaredAcceleration = 0;
  private linearSum: Vector3 = [0, 0, 0];
  private rotationSum: Vector3 = [0, 0, 0];
  private squaredRotation = 0;
  private squaredHorizontal = 0;
  private rotationPeak = 0;
  private longitudinalMin = 0;
  private longitudinalMax = 0;
  private yawLeft = 0;
  private yawRight = 0;
  private maxTilt = 0;
  private maxGap = 0;
  private firstTimestamp: number | null = null;
  private lastTimestamp: number | null = null;
  private lastArrival = 0;
  private reference: MountReference | null;
  private forwardSum: Vector3 = [0, 0, 0];
  private forwardMagnitudeSum = 0;
  private forwardDuration = 0;
  private forwardSamples = 0;
  private forwardComplete = false;
  private forwardRejected = false;
  private previousForwardSample = false;

  private resetForwardWindow() {
    this.forwardSum = [0, 0, 0];
    this.forwardMagnitudeSum = 0;
    this.forwardDuration = 0;
    this.forwardSamples = 0;
    this.previousForwardSample = false;
  }

  private validForwardWindow() {
    const length = magnitude(this.forwardSum);
    return this.forwardDuration * 1000 >= this.forwardLimits.durationMs
      && this.forwardSamples >= this.forwardLimits.samples
      && length / this.forwardSamples >= this.forwardLimits.acceleration
      && this.forwardMagnitudeSum > 0 && length / this.forwardMagnitudeSum >= this.forwardLimits.coherence;
  }

  // Retain the first qualifying direction so the later stop cannot cancel it.
  private learnForward(horizontal: Vector3, seconds: number) {
    if (this.forwardComplete || this.forwardRejected) return;
    if (this.forwardLimits.durationMs === 0 && this.forwardLimits.samples === 1) {
      const acceleration = magnitude(horizontal);
      if (acceleration >= this.forwardLimits.acceleration) {
        this.forwardSum = [...horizontal];
        this.forwardMagnitudeSum = acceleration;
        this.forwardSamples = 1;
        this.forwardComplete = true;
      }
      return;
    }
    if (magnitude(horizontal) < this.forwardLimits.acceleration || seconds > 0.25) {
      if (this.validForwardWindow()) this.forwardComplete = true;
      else {
        this.forwardRejected = this.firstLaunchOnly && this.previousForwardSample;
        this.resetForwardWindow();
      }
      this.previousForwardSample = false;
      return;
    }
    if (this.previousForwardSample && seconds > 0) {
      this.forwardSum = this.forwardSum.map((value, index) => value + horizontal[index]) as Vector3;
      this.forwardMagnitudeSum += magnitude(horizontal);
      this.forwardDuration += seconds;
      this.forwardSamples++;
      if (this.firstLaunchOnly && this.validForwardWindow()) this.forwardComplete = true;
      if (this.forwardDuration >= 0.75) {
        if (this.validForwardWindow()) this.forwardComplete = true;
        else { this.forwardRejected = this.firstLaunchOnly; this.resetForwardWindow(); return; }
      }
    }
    this.previousForwardSample = true;
  }

  private readonly learningForward: boolean;

  private readonly forwardLimits: ForwardCalibrationLimits;
  private readonly maximumSamples: number;
  private readonly firstLaunchOnly: boolean;

  constructor(reference: MountReference | null, forwardLimits: ForwardCalibrationLimits = { acceleration: 0.5, durationMs: 500, coherence: 0.9, samples: 5 }, maximumSamples = 2000, firstLaunchOnly = false) {
    if (!Number.isInteger(maximumSamples) || maximumSamples < 1 || maximumSamples > 10000) throw new Error('Invalid motion sample limit.');
    this.maximumSamples = maximumSamples;
    this.forwardLimits = forwardLimits;
    this.firstLaunchOnly = firstLaunchOnly;
    this.reference = reference;
    this.learningForward = reference !== null && reference.forward === null;
  }

  add(acceleration: Vector3, gravity: Vector3, rotation: Vector3, timestamp: number, arrivalMs: number) {
    if (![...acceleration, ...gravity, ...rotation, timestamp, arrivalMs].every(Number.isFinite) || magnitude(gravity) < 1) return;
    if (this.lastTimestamp !== null && timestamp <= this.lastTimestamp) return;
    if (this.count >= this.maximumSamples) throw new Error('Too many motion readings. Stop and repeat this step.');
    const down = unit(gravity);
    if (!this.reference) {
      this.reference = { down, forward: null };
    }
    const seconds = this.lastTimestamp === null ? 0 : timestamp - this.lastTimestamp;
    const yawRate = -dot(rotation, this.reference.down);
    if (seconds <= 0.25) {
      this.yawLeft += Math.max(0, yawRate) * seconds;
      this.yawRight += Math.max(0, -yawRate) * seconds;
    }
    const referenceDown = this.reference.down;
    const vertical = dot(acceleration, referenceDown);
    const horizontal = acceleration.map((value, index) => value - vertical * referenceDown[index]) as Vector3;
    this.squaredHorizontal += dot(horizontal, horizontal);
    if (this.learningForward) {
      this.learnForward(horizontal, seconds);
    }
    const longitudinal = this.reference.forward ? dot(acceleration, this.reference.forward) : 0;
    this.longitudinalMin = Math.min(this.longitudinalMin, longitudinal);
    this.longitudinalMax = Math.max(this.longitudinalMax, longitudinal);
    this.maxTilt = Math.max(this.maxTilt, Math.acos(Math.max(-1, Math.min(1, dot(down, this.reference.down)))) * 180 / Math.PI);
    this.gravitySum = this.gravitySum.map((value, index) => value + gravity[index]) as Vector3;
    this.squaredAcceleration += dot(acceleration, acceleration);
    this.linearSum = this.linearSum.map((value, index) => value + acceleration[index]) as Vector3;
    this.rotationSum = this.rotationSum.map((value, index) => value + rotation[index]) as Vector3;
    this.squaredRotation += dot(rotation, rotation);
    this.rotationPeak = Math.max(this.rotationPeak, magnitude(rotation));
    this.maxGap = Math.max(this.maxGap, arrivalMs - this.lastArrival, seconds * 1000);
    this.firstTimestamp ??= timestamp;
    this.lastTimestamp = timestamp;
    this.lastArrival = arrivalMs;
    this.count += 1;
  }

  summary(elapsedMs: number) {
    if (!this.count || this.firstTimestamp === null || this.lastTimestamp === null) throw new Error('No usable motion readings were received. Check motion access and repeat this step.');
    const linearMean = this.linearSum.map((value) => value / this.count) as Vector3;
    const rotationMean = this.rotationSum.map((value) => value / this.count) as Vector3;
    return {
      linear_mean_x: linearMean[0], linear_mean_y: linearMean[1], linear_mean_z: linearMean[2],
      linear_stddev: Math.sqrt(Math.max(0, this.squaredAcceleration / this.count - dot(linearMean, linearMean))),
      horizontal_rms: Math.sqrt(this.squaredHorizontal / this.count),
      rotation_mean_x: rotationMean[0], rotation_mean_y: rotationMean[1], rotation_mean_z: rotationMean[2],
      rotation_rms: Math.sqrt(this.squaredRotation / this.count),
      rotation_stddev: Math.sqrt(Math.max(0, this.squaredRotation / this.count - dot(rotationMean, rotationMean))),
      forward_x: this.forwardSamples ? this.forwardSum[0] / this.forwardSamples : 0,
      forward_y: this.forwardSamples ? this.forwardSum[1] / this.forwardSamples : 0,
      forward_z: this.forwardSamples ? this.forwardSum[2] / this.forwardSamples : 0,
      forward_duration_ms: this.forwardDuration * 1000,
      forward_sample_count: this.forwardSamples,
      forward_coherence: this.forwardMagnitudeSum ? Math.min(1, magnitude(this.forwardSum) / this.forwardMagnitudeSum) : 0,
      sample_count: this.count,
      sensor_duration_ms: (this.lastTimestamp - this.firstTimestamp) * 1000,
      max_gap_ms: Math.max(this.maxGap, elapsedMs - this.lastArrival),
      linear_rms: Math.sqrt(this.squaredAcceleration / this.count),
      rotation_peak: this.rotationPeak,
      longitudinal_min: this.longitudinalMin,
      longitudinal_max: this.longitudinalMax,
      yaw_left_degrees: this.yawLeft,
      yaw_right_degrees: this.yawRight,
      max_tilt_degrees: this.maxTilt,
      gravity_x: this.gravitySum[0] / this.count,
      gravity_y: this.gravitySum[1] / this.count,
      gravity_z: this.gravitySum[2] / this.count,
    };
  }
}
