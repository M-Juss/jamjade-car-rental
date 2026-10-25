import type { ResearchIntensity, ResearchMovement, ResearchSample } from "@/services/research/types";

export const movementLabels: Record<ResearchMovement, string> = {
  stationary: "Stationary", steady_movement: "Steady movement", acceleration: "Acceleration",
  braking: "Braking", left_turn: "Left turn", right_turn: "Right turn",
};

export function maneuverLabel(movement: ResearchMovement, intensity: ResearchIntensity) {
  return `${intensity === "harsh" ? "Harsh " : intensity === "normal" ? "Normal " : ""}${movementLabels[movement].toLowerCase()}`.replace(/^./, (letter) => letter.toUpperCase());
}

export function seconds(ms: number) { return `${(ms / 1000).toFixed(2)} s`; }
export function humanize(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()) : "Not recorded";
}

export type SignalPoint = { time: number; x: number | null; y: number | null; z: number | null };
export type SignalKind = "linear" | "including_gravity" | "rotation";
export const DISPLAY_GAP_MS = 250; // Existing v1 quality flag boundary; not a maneuver threshold.

export function timelineOrigin(samples: ResearchSample[]) {
  return samples.length ? samples[0].acceleration_timestamp_s - samples[0].elapsed_ms / 1000 : 0;
}

export function signalTime(sample: ResearchSample, kind: SignalKind, origin: number) {
  const timestamp = kind === "rotation" ? sample.rotation_timestamp_s
    : kind === "including_gravity" ? sample.gravity_timestamp_s : sample.acceleration_timestamp_s;
  // Round only the display timeline to microseconds, avoiding floating-point boundary loss.
  return Math.round((timestamp - origin) * 1e6) / 1000;
}

export function signalPoints(samples: ResearchSample[], kind: SignalKind): SignalPoint[] {
  const origin = timelineOrigin(samples);
  const points: SignalPoint[] = [];
  for (const sample of samples) {
    const time = signalTime(sample, kind, origin);
    const point = { time, x: sample[`${kind}_x`], y: sample[`${kind}_y`], z: sample[`${kind}_z`] };
    const previous = points.at(-1);
    // DeviceMotion can reuse the most recent gyro/gravity event. Do not draw duplicate time points.
    if (previous?.time === time) { points[points.length - 1] = point; continue; }
    if (previous && time - previous.time > DISPLAY_GAP_MS) {
      points.push({ time: (time + previous.time) / 2, x: null, y: null, z: null });
    }
    points.push(point);
  }
  return points;
}

// Saved v1 annotations use recorder elapsed time. Map their bounds to the sensor timeline.
export function annotationTime(samples: ResearchSample[], elapsed: number): number {
  if (!samples.length) return elapsed;
  const origin = timelineOrigin(samples);
  const nextIndex = samples.findIndex((sample) => sample.elapsed_ms >= elapsed);
  const right = samples[nextIndex === -1 ? samples.length - 1 : nextIndex];
  const left = samples[Math.max(0, (nextIndex === -1 ? samples.length - 1 : nextIndex) - 1)];
  if (left === right) return signalTime(right, "linear", origin) + elapsed - right.elapsed_ms;
  const ratio = (elapsed - left.elapsed_ms) / (right.elapsed_ms - left.elapsed_ms);
  return signalTime(left, "linear", origin) + ratio * (signalTime(right, "linear", origin) - signalTime(left, "linear", origin));
}

export function intervalStats(points: SignalPoint[], start: number, end: number) {
  const included = points.filter((point) => point.time >= start && point.time <= end && point.x !== null && point.y !== null && point.z !== null);
  if (!included.length) return null;
  const magnitudes = included.map((point) => Math.hypot(point.x!, point.y!, point.z!));
  return {
    count: included.length,
    peak: Math.max(...magnitudes),
    rms: Math.sqrt(magnitudes.reduce((sum, value) => sum + value * value, 0) / included.length),
    mean: (["x", "y", "z"] as const).map((axis) => included.reduce((sum, point) => sum + point[axis]!, 0) / included.length),
  };
}

export function nearestPoint(points: SignalPoint[], time: number) {
  let result: SignalPoint | null = null;
  for (const point of points) {
    if (point.x === null) continue;
    if (!result || Math.abs(point.time - time) < Math.abs(result.time - time)) result = point;
  }
  // Never imply there is a measurement in the middle of a long gap.
  return result && Math.abs(result.time - time) <= DISPLAY_GAP_MS / 2 ? result : null;
}
