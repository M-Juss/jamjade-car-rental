import type { NativeEvent } from "@/services/research/native-types";
import { nativeIntervalStats } from "./native-analysis";
import type { SignalPoint } from "./recording-analysis";

export const STATIONARY_PREVIEW_VERSION = "stationary-mean-v1";
// Preview budget, not a learned stationarity or maneuver threshold.
export const MIN_REFERENCE_PREVIEW_MS = 5000;

type ChannelReference = {
  count: number;
  mean: number[];
  std: number[];
  spanMs: number;
  largestGapMs: number;
  leadingGapMs: number;
  trailingGapMs: number;
};
type PreviewResult = { available: false; reason: string } | {
  available: true;
  acceleration: ChannelReference;
  gyroscope: ChannelReference;
  magnitude: number;
  upUnit: number[];
  directionChangeDegrees: number | null;
};

export function channelReference(events: NativeEvent[], origin: bigint, start: number, end: number, label: string) {
  const points: SignalPoint[] = [];
  let previous: NativeEvent | null = null;
  let previousTime = 0;
  let largestGapMs = 0;
  for (const event of events) {
    const time = Number(BigInt(event.sensor_timestamp_ns) - origin) / 1e6;
    if (time < start || time > end) continue;
    if (event.values.length !== 3 || !event.values.every(Number.isFinite) || !Number.isFinite(time)) {
      throw new Error(`${label} contains invalid readings.`);
    }
    if (previous) {
      if (time <= previousTime) throw new Error(`${label} contains repeated or backward timestamps.`);
      if (event.sequence !== previous.sequence + 1) throw new Error(`${label} contains a sequence gap.`);
      largestGapMs = Math.max(largestGapMs, time - previousTime);
    }
    points.push({ time, x: event.values[0], y: event.values[1], z: event.values[2] });
    previous = event;
    previousTime = time;
  }
  if (points.length < 2) throw new Error(`${label} needs at least two readings in this interval.`);
  const stats = nativeIntervalStats(points, start, end)!;
  if (![...stats.mean, ...stats.std, stats.rms, stats.peak].every(Number.isFinite)) {
    throw new Error(`${label} statistics exceed the supported numeric range.`);
  }
  return {
    points,
    summary: {
      count: stats.count, mean: stats.mean, std: stats.std,
      spanMs: points.at(-1)!.time - points[0].time,
      largestGapMs, leadingGapMs: points[0].time - start, trailingGapMs: end - points.at(-1)!.time,
    } satisfies ChannelReference,
  };
}

/** Independent raw-channel means; no resampling, filtering, alignment or saved calibration. */
export function stationaryReferencePreview(acceleration: NativeEvent[], gyroscope: NativeEvent[], origin: string, start: number, end: number): PreviewResult {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end - start < MIN_REFERENCE_PREVIEW_MS) {
    return { available: false, reason: "Select at least 5 seconds for the reference preview." };
  }
  try {
    const epoch = BigInt(origin);
    const accel = channelReference(acceleration, epoch, start, end, "Accelerometer");
    const gyro = channelReference(gyroscope, epoch, start, end, "Gyroscope");
    const magnitude = Math.hypot(...accel.summary.mean);
    if (magnitude < 1e-9 || !Number.isFinite(magnitude)) {
      return { available: false, reason: "The resting acceleration vector has no usable direction." };
    }
    const midpoint = (start + end) / 2;
    const first = nativeIntervalStats(accel.points.filter(point => point.time < midpoint), start, midpoint);
    const last = nativeIntervalStats(accel.points.filter(point => point.time >= midpoint), midpoint, end);
    const firstNorm = first ? Math.hypot(...first.mean) : 0;
    const lastNorm = last ? Math.hypot(...last.mean) : 0;
    const cosine = first && last && firstNorm > 1e-9 && lastNorm > 1e-9
      ? first.mean.reduce((sum, value, index) => sum + value / firstNorm * (last.mean[index] / lastNorm), 0) : null;
    return {
      available: true, acceleration: accel.summary, gyroscope: gyro.summary, magnitude,
      upUnit: accel.summary.mean.map(value => value / magnitude),
      directionChangeDegrees: cosine === null ? null : Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI,
    };
  } catch (error) {
    return { available: false, reason: error instanceof Error && error.name === "Error" ? error.message : "Sensor timestamps could not be read." };
  }
}
