import type { NativeEvent } from "@/services/research/native-types";
import { channelReference } from "./stationary-reference";

export type ReferenceRange = [number, number];
export type ForwardRanges = { rest: ReferenceRange; starting: ReferenceRange; stopping: ReferenceRange };
type Vector = [number, number, number];
export const FORWARD_PREVIEW_VERSION = "horizontal-pca-v1";
const dot = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const scale = (v: number[], factor: number): Vector => v.map(value => value * factor) as Vector;
const cross = (a: number[], b: number[]): Vector => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v: number[], reason: string): Vector => {
  const length = Math.hypot(...v);
  if (!Number.isFinite(length) || length < 1e-9) throw new Error(reason);
  return scale(v, 1 / length);
};
const degrees = (cosine: number) => Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;

function principalAxis(coords: number[][]) {
  const mean = [0, 1].map(i => coords.reduce((sum, point) => sum + point[i], 0) / coords.length);
  const xx = coords.reduce((sum, p) => sum + (p[0] - mean[0]) ** 2, 0) / coords.length;
  const yy = coords.reduce((sum, p) => sum + (p[1] - mean[1]) ** 2, 0) / coords.length;
  const xy = coords.reduce((sum, p) => sum + (p[0] - mean[0]) * (p[1] - mean[1]), 0) / coords.length;
  const trace = xx + yy;
  const separation = Math.hypot(xx - yy, 2 * xy);
  // Numerical degeneracy checks, not learned motion/noise thresholds.
  if (!Number.isFinite(trace) || trace < 1e-12 || separation <= trace * 1e-6) {
    throw new Error("The starting interval has no distinct horizontal axis. Select a clearer start.");
  }
  const angle = Math.atan2(2 * xy, xx - yy) / 2;
  return { axis: [Math.cos(angle), Math.sin(angle)], varianceShare: (trace + separation) / (2 * trace) };
}

export function restingFrame(mean: number[]) {
  const up = unit(mean, "The resting acceleration has no usable gravity direction.");
  const top = unit([0, 1, 0].map((value, i) => value - up[1] * up[i]), "The phone top has no horizontal projection. Check the mount orientation.");
  return { up, top, right: cross(top, up) };
}

/** Research-only, fixed resting frame. No automatic direction input, filtering or stored calibration. */
export function forwardReferencePreview(acceleration: NativeEvent[], gyroscope: NativeEvent[], origin: string, ranges: ForwardRanges, bounds: ReferenceRange) {
  try {
    if (!bounds.every(Number.isFinite) || bounds[0] < 0 || bounds[1] <= bounds[0] || bounds[1] - bounds[0] > 30000) {
      throw new Error("Load a signal window of at most 30 seconds before selecting references.");
    }
    for (const range of Object.values(ranges)) {
      if (!range.every(Number.isFinite) || range[0] < bounds[0] || range[1] > bounds[1] || range[1] - range[0] < 500) {
        throw new Error("Choose intervals of at least 0.5 seconds within the loaded signal window.");
      }
    }
    if (ranges.rest[1] > ranges.starting[0] || ranges.starting[1] > ranges.stopping[0]) {
      throw new Error("Use separate intervals in this order: resting, starting, stopping.");
    }
    const epoch = BigInt(origin);
    const channels = Object.fromEntries(Object.entries(ranges).map(([phase, range]) => [phase, {
      acceleration: channelReference(acceleration, epoch, ...range, "Accelerometer"),
      gyroscope: channelReference(gyroscope, epoch, ...range, "Gyroscope"),
    }])) as Record<keyof ForwardRanges, {
      acceleration: ReturnType<typeof channelReference>; gyroscope: ReturnType<typeof channelReference>;
    }>;
    const { up, top, right: baseRight } = restingFrame(channels.rest.acceleration.summary.mean);
    const pca = principalAxis(channels.starting.acceleration.points.map(p => {
      const v = [p.x!, p.y!, p.z!];
      return [dot(v, baseRight), dot(v, top)];
    }));
    let forward = unit(up.map((_, i) => pca.axis[0] * baseRight[i] + pca.axis[1] * top[i]), "The forward axis is unavailable.");
    const startProjection = dot(channels.starting.acceleration.summary.mean, forward);
    if (Math.abs(startProjection) < 1e-9) throw new Error("The starting mean cannot resolve the axis sign. Select a clearer forward acceleration.");
    // PCA has no sign; the operator-confirmed forward start determines it.
    if (startProjection < 0) forward = scale(forward, -1);
    const right = cross(forward, up);
    const gyroOffset = channels.rest.gyroscope.summary.mean;
    const phases = (["rest", "starting", "stopping"] as const).map(phase => {
      const { acceleration: accel, gyroscope: gyro } = channels[phase];
      const rotations = gyro.points.map(p => dot([p.x! - gyroOffset[0], p.y! - gyroOffset[1], p.z! - gyroOffset[2]], up));
      return { phase, acceleration: accel.summary, gyroscope: gyro.summary,
        forwardMean: dot(accel.summary.mean, forward), rightMean: dot(accel.summary.mean, right),
        upRotationRms: Math.sqrt(rotations.reduce((sum, value) => sum + value ** 2, 0) / rotations.length) };
    });
    const starting = phases[1]; const stopping = phases[2];
    const startLength = Math.hypot(starting.forwardMean, starting.rightMean);
    const stopLength = Math.hypot(stopping.forwardMean, stopping.rightMean);
    const stopOppositionDegrees = stopLength < 1e-9 ? null : degrees(
      -(starting.forwardMean * stopping.forwardMean + starting.rightMean * stopping.rightMean) / (startLength * stopLength));
    const warnings: string[] = [];
    if (ranges.rest[1] - ranges.rest[0] < 5000) warnings.push("Resting interval < 5 s: short pilot estimate.");
    if (dot(forward, top) <= 0) warnings.push("The estimated forward direction opposes the phone top. Check the selected start and mount.");
    if (stopping.forwardMean >= 0) warnings.push("The stopping mean does not oppose the starting direction. Review the selected intervals.");
    return { available: true as const, forward, right, up, phases, warnings,
      varianceShare: pca.varianceShare, angleFromPhoneTop: degrees(dot(forward, top)), stopOppositionDegrees,
      // A right-handed rotation: rows multiply phone XYZ to produce Right / Forward / Up.
      rotationRfu: [right, forward, up] };
  } catch (error) {
    return { available: false as const, reason: error instanceof Error && error.name === "Error" ? error.message : "Sensor timestamps could not be read." };
  }
}

export type ForwardReferenceCandidate = Extract<ReturnType<typeof forwardReferencePreview>, { available: true }>;
