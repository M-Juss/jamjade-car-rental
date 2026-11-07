import type { NativeEvent } from '@/services/research/native-types';
import { restingFrame, type ReferenceRange } from './forward-reference';
import { suggestForwardIntervals } from './reference-suggestions';
import { channelReference } from './stationary-reference';
import type { TimingSuggestion } from './fss-interval-suggestions';

export const LT_TIMING_VERSION = 'lt-intervals-v1';
const BIN_MS = 250;
const MIN_TURN_MS = 750;
const dot = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * b[i], 0);

/** Planned single normal LT only; proposes times without assigning training labels. */
export function suggestLtIntervals(protocol: string | undefined, acceleration: NativeEvent[], gyroscope: NativeEvent[], origin: string,
  bounds: ReferenceRange, duration: number) {
  if (protocol !== 'LT') return { available: false as const, reason: 'These timing suggestions are available for LT only.' };
  if (bounds[0] !== 0 || bounds[1] !== duration || duration > 30000) {
    return { available: false as const, reason: 'Load the complete LT recording, up to 30 seconds. Otherwise select intervals manually.' };
  }
  const base = suggestForwardIntervals(acceleration, gyroscope, origin, bounds, 250);
  if (!base.available) return base;
  try {
    const epoch = BigInt(origin);
    const { rest, starting, stopping } = base.ranges;
    const a = channelReference(acceleration, epoch, ...rest, 'Accelerometer');
    const g = channelReference(gyroscope, epoch, ...rest, 'Gyroscope');
    const { up } = restingFrame(a.summary.mean);
    const yaw = (v: number[]) => dot(v.map((value, i) => value - g.summary.mean[i]), up);
    const noise = Math.sqrt(g.points.reduce((sum, p) => sum + yaw([p.x!, p.y!, p.z!]) ** 2, 0) / g.points.length);
    // Adaptive experimental timing limit; neither a harshness nor quality threshold.
    const limit = Math.max(1e-4, 6 * noise);
    const points = channelReference(gyroscope, epoch, ...bounds, 'Gyroscope').points;
    const buckets = new Map<number, number[]>();
    for (const p of points) {
      const bin = Math.floor(p.time / BIN_MS);
      const values = buckets.get(bin) ?? [];
      values.push(yaw([p.x!, p.y!, p.z!])); buckets.set(bin, values);
    }
    const findRuns = (sign: 1 | -1) => {
      const result: ReferenceRange[] = []; let active: ReferenceRange | null = null;
      for (let start = 0; start < duration; start += BIN_MS) {
        const values = buckets.get(start / BIN_MS) ?? [];
        const matches = values.length >= 3 && sign * values.reduce((sum, v) => sum + v, 0) / values.length > limit;
        if (matches) { if (active) active[1] = Math.min(duration, start + BIN_MS); else active = [start, Math.min(duration, start + BIN_MS)]; }
        else if (active) { if (active[1] - active[0] >= MIN_TURN_MS) result.push(active); active = null; }
      }
      if (active && active[1] - active[0] >= MIN_TURN_MS) result.push(active);
      return result;
    };
    const left = findRuns(1), right = findRuns(-1);
    if (left.length !== 1 || right.length) return { available: false as const,
      reason: 'No single clear left-turn section, or several/opposite turns are present. Select intervals manually.' };
    const turn = left[0];
    if (turn[0] < starting[1] || turn[1] > stopping[0]) return { available: false as const,
      reason: 'Turning overlaps the start or stop candidate. Review these combined movements manually.' };
    const ranges: ReferenceRange[] = [rest, starting];
    if (turn[0] - starting[1] >= 500) ranges.push([starting[1], turn[0]]);
    ranges.push(turn);
    if (stopping[0] - turn[1] >= 500) ranges.push([turn[1], stopping[0]]);
    ranges.push(stopping);
    if (base.quietAfter) ranges.push(base.quietAfter);
    return { available: true as const, intervals: ranges.map((range, i): TimingSuggestion => ({ id: `${LT_TIMING_VERSION}-${i}`, range: [...range] })), notes: base.notes };
  } catch {
    return { available: false as const, reason: 'Turning data could not be verified. Select intervals manually.' };
  }
}
