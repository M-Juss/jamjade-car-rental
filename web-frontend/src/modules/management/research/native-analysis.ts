import type { NativeEvent } from "@/services/research/native-types";
import { intervalStats, type SignalPoint } from "./recording-analysis";

export function nativeSignalPoints(events: NativeEvent[], origin: string): SignalPoint[] {
  const start = BigInt(origin);
  const points: SignalPoint[] = [];
  for (const event of events) {
    const time = Number(BigInt(event.sensor_timestamp_ns) - start) / 1e6;
    const previous = points.at(-1);
    if (previous && (time <= previous.time || time - previous.time > 250)) {
      points.push({ time: (time + previous.time) / 2, x: null, y: null, z: null });
    }
    points.push({ time, x: event.values[0], y: event.values[1], z: event.values[2] });
  }
  return points;
}

export function nativeIntervalStats(points: SignalPoint[], start: number, end: number) {
  const stats = intervalStats(points, start, end);
  if (!stats) return null;
  const included = points.filter(p => p.time >= start && p.time <= end && p.x !== null && p.y !== null && p.z !== null);
  const std = (["x", "y", "z"] as const).map((axis, i) => Math.sqrt(included.reduce((sum, p) => sum + (p[axis]! - stats.mean[i]) ** 2, 0) / included.length));
  return { ...stats, std };
}
