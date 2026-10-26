import type { NativeEvent } from "@/services/research/native-types";
import type { ReferenceRange } from "./forward-reference";
import type { SignalPoint } from "./recording-analysis";
import { channelReference } from "./stationary-reference";

export const SYNCHRONIZATION_VERSION = "linear-grid-50hz-v1";
// Experimental inspection settings, not a learned gap/quality rule or final ML rate.
export const GRID_STEP_MS = 20;
export const MAX_INTERPOLATION_MS = 60;
const STEP_NS = BigInt(GRID_STEP_MS) * BigInt(1000000);
const MAX_SPAN_NS = BigInt(MAX_INTERPOLATION_MS) * BigInt(1000000);
type Vector = [number, number, number];
export type SynchronizedValue = {
  state: "original" | "interpolated" | "gap" | "outside";
  values: Vector | null;
  sourceTimesNs: [string, string] | null;
  bracketMs: number | null;
};
export type SynchronizedRow = { time: number; sensorTimestampNs: string; acceleration: SynchronizedValue; gyroscope: SynchronizedValue };
export function synchronizationCounts(rows: SynchronizedRow[]) {
  const channel = (key: "acceleration" | "gyroscope") => ({
    original: rows.filter(row => row[key].state === "original").length,
    interpolated: rows.filter(row => row[key].state === "interpolated").length,
    gap: rows.filter(row => row[key].state === "gap").length,
    outside: rows.filter(row => row[key].state === "outside").length,
  });
  return { rows: rows.length, paired: rows.filter(row => row.acceleration.values !== null && row.gyroscope.values !== null).length,
    acceleration: channel("acceleration"), gyroscope: channel("gyroscope") };
}

/** Bounded local preview: independent linear interpolation, never extrapolation or hole filling. */
export function synchronizationPreview(acceleration: NativeEvent[], gyroscope: NativeEvent[], origin: string, bounds: ReferenceRange) {
  try {
    const offsets = bounds.map(value => Math.round(value * 1e6));
    if (!bounds.every(Number.isFinite) || !offsets.every(Number.isSafeInteger) || bounds[0] < 0 || bounds[1] <= bounds[0] || bounds[1] - bounds[0] > 30000) {
      throw new Error("Load a signal window of at most 30 seconds for synchronization.");
    }
    if (!/^\d+$/.test(origin)) throw new Error("The recording sensor clock is invalid.");
    const epoch = BigInt(origin);
    const begin = BigInt(offsets[0]); const end = BigInt(offsets[1]);
    const prepare = (events: NativeEvent[], label: string) => {
      const selected = events.map(event => {
        if (!/^\d+$/.test(event.sensor_timestamp_ns)) throw new Error(`${label} contains an invalid timestamp.`);
        return { event, time: BigInt(event.sensor_timestamp_ns) - epoch };
      }).filter(item => item.time >= begin && item.time <= end);
      if (selected.some(item => !Number.isSafeInteger(item.event.sequence) || item.event.sequence < 0)) throw new Error(`${label} contains an invalid sequence.`);
      const original = selected.map(item => item.event);
      const { summary } = channelReference(original, epoch, ...bounds, label);
      return { selected, summary };
    };
    const accel = prepare(acceleration, "Accelerometer"); const gyro = prepare(gyroscope, "Gyroscope");
    const grid: bigint[] = [];
    for (let time = ((begin + STEP_NS - BigInt(1)) / STEP_NS) * STEP_NS; time <= end; time += STEP_NS) grid.push(time);
    if (!grid.length) throw new Error("This window contains no 20 ms grid rows.");
    const sample = (source: ReturnType<typeof prepare>) => {
      let index = 0;
      return (target: bigint): SynchronizedValue => {
        while (index < source.selected.length && source.selected[index].time < target) index++;
        const next = source.selected[index]; const previous = source.selected[index - 1];
        if (next?.time === target) return { state: "original", values: [...next.event.values] as Vector,
          sourceTimesNs: [next.event.sensor_timestamp_ns, next.event.sensor_timestamp_ns], bracketMs: 0 };
        if (!previous || !next) return { state: "outside", values: null, sourceTimesNs: null, bracketMs: null };
        const span = next.time - previous.time;
        const sourceTimesNs: [string, string] = [previous.event.sensor_timestamp_ns, next.event.sensor_timestamp_ns];
        const bracketMs = Number(span) / 1e6;
        if (span > MAX_SPAN_NS) return { state: "gap", values: null, sourceTimesNs, bracketMs };
        const fraction = Number(target - previous.time) / Number(span);
        const values = previous.event.values.map((value, axis) => (1 - fraction) * value + fraction * next.event.values[axis]) as Vector;
        if (!values.every(Number.isFinite)) throw new Error("Interpolated readings exceed the supported numeric range.");
        return { state: "interpolated", values, sourceTimesNs, bracketMs };
      };
    };
    const accelerationAt = sample(accel); const gyroscopeAt = sample(gyro);
    const rows: SynchronizedRow[] = grid.map(time => ({ time: Number(time) / 1e6, sensorTimestampNs: String(epoch + time),
      acceleration: accelerationAt(time), gyroscope: gyroscopeAt(time) }));
    const points = (key: "acceleration" | "gyroscope"): SignalPoint[] => rows.map(row => ({ time: row.time,
      x: row[key].values?.[0] ?? null, y: row[key].values?.[1] ?? null, z: row[key].values?.[2] ?? null }));
    return { available: true as const, rows, counts: synchronizationCounts(rows),
      acceleration: points("acceleration"), gyroscope: points("gyroscope"),
      sourceCounts: { acceleration: accel.summary.count, gyroscope: gyro.summary.count } };
  } catch (error) {
    return { available: false as const, reason: error instanceof Error && error.name === "Error" ? error.message : "Sensor timestamps could not be read for synchronization." };
  }
}
