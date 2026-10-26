import type { ReferenceRange } from "./forward-reference";
import type { SignalPoint } from "./recording-analysis";
import { GRID_STEP_MS } from "./synchronization-preview";

export const FILTER_VERSION = "butterworth2-causal-50hz-v1";
export const FILTER_CUTOFFS = [3, 5, 8] as const;
export type FilterCutoff = typeof FILTER_CUTOFFS[number];
// Experimental restart exclusion, not a measured settling/noise specification.
export const FILTER_WARMUP_MS = 500;
const axes = ["x", "y", "z"] as const;
export type FilteredChannel = { before: SignalPoint[]; after: SignalPoint[]; warmup: boolean[]; segments: number };

export function butterworthCoefficients(cutoff: FilterCutoff) {
  if (!(FILTER_CUTOFFS as readonly number[]).includes(cutoff)) throw new Error("Choose a 3, 5 or 8 Hz cutoff.");
  const k = Math.tan(Math.PI * cutoff / (1000 / GRID_STEP_MS));
  const norm = 1 / (1 + Math.SQRT2 * k + k * k);
  return { b: [k * k * norm, 2 * k * k * norm, k * k * norm],
    a: [1, 2 * (k * k - 1) * norm, (1 - Math.SQRT2 * k + k * k) * norm] };
}

function filterChannel(points: SignalPoint[], coefficients: ReturnType<typeof butterworthCoefficients>): FilteredChannel {
  if (!points.length || points.length > 1501) throw new Error("Load a synchronized window of at most 30 seconds.");
  const before: SignalPoint[] = []; const after: SignalPoint[] = []; const warmup: boolean[] = [];
  const { b, a } = coefficients;
  let previousInput: number[] | null = null; let olderInput: number[] = [];
  let previousOutput: number[] = []; let olderOutput: number[] = [];
  let segmentStart = 0; let segments = 0;
  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    if (!Number.isFinite(point.time) || point.time < 0 || Math.abs(point.time / GRID_STEP_MS - Math.round(point.time / GRID_STEP_MS)) > 1e-6
      || (index && Math.abs(point.time - points[index - 1].time - GRID_STEP_MS) > 1e-6)) {
      throw new Error("Filtering requires a continuous 20 ms grid, with missing rows retained.");
    }
    const input = axes.map(axis => point[axis]);
    const missing = input.every(value => value === null);
    if (!missing && !input.every(value => typeof value === "number" && Number.isFinite(value))) throw new Error("The synchronized grid contains invalid components.");
    before.push({ ...point });
    if (missing) {
      previousInput = null;
      after.push({ time: point.time, x: null, y: null, z: null }); warmup.push(false);
      continue;
    }
    const current = input as number[];
    if (!previousInput) {
      // Constant-extension initial condition: gravity/DC does not ramp up from zero.
      previousInput = [...current]; olderInput = [...current]; previousOutput = [...current]; olderOutput = [...current];
      segmentStart = point.time; segments++;
    }
    const output = current.map((value, axis) => b[0] * value + b[1] * previousInput![axis] + b[2] * olderInput[axis]
      - a[1] * previousOutput[axis] - a[2] * olderOutput[axis]);
    if (!output.every(Number.isFinite)) throw new Error("Filtered values exceed the supported numeric range.");
    olderInput = previousInput; previousInput = [...current]; olderOutput = previousOutput; previousOutput = output;
    const warming = point.time - segmentStart < FILTER_WARMUP_MS;
    warmup.push(warming);
    after.push({ time: point.time, x: warming ? null : output[0], y: warming ? null : output[1], z: warming ? null : output[2] });
  }
  return { before, after, warmup, segments };
}

export function lowPassPreview(acceleration: SignalPoint[], gyroscope: SignalPoint[], cutoff: FilterCutoff) {
  try {
    if (acceleration.length !== gyroscope.length || acceleration.some((point, index) => point.time !== gyroscope[index].time)) {
      throw new Error("Both channels must use the same synchronized grid.");
    }
    const coefficients = butterworthCoefficients(cutoff);
    return { available: true as const, coefficients, acceleration: filterChannel(acceleration, coefficients), gyroscope: filterChannel(gyroscope, coefficients) };
  } catch (error) {
    return { available: false as const, reason: error instanceof Error && error.name === "Error" ? error.message : "The filter preview could not read this grid." };
  }
}

/** Descriptive comparisons on identical post-warm-up rows; not a noise or event-validity score. */
export function filterComparison(channel: FilteredChannel, range: ReferenceRange) {
  if (!range.every(Number.isFinite) || range[1] < range[0]) throw new Error("Choose a valid comparison interval.");
  const selected = channel.before.map((point, index) => ({ point, index })).filter(({ point }) => point.time >= range[0] && point.time <= range[1]);
  const paired = selected.filter(({ point, index }) => point.x !== null && channel.after[index].x !== null);
  const stats = (key: "before" | "after", axis: typeof axes[number]) => {
    const values = paired.map(({ index }) => channel[key][index]);
    const mean = values.reduce((sum, point) => sum + point[axis]!, 0) / values.length;
    const std = Math.sqrt(values.reduce((sum, point) => sum + (point[axis]! - mean) ** 2, 0) / values.length);
    const peak = values.reduce((current, point) => !current || Math.abs(point[axis]!) > Math.abs(current[axis]!) ? point : current, null as SignalPoint | null)!;
    return { mean, std, peak: Math.abs(peak[axis]!), peakTime: peak.time };
  };
  return { total: selected.length, paired: paired.length, warmup: selected.filter(({ index }) => channel.warmup[index]).length,
    missing: selected.filter(({ point }) => point.x === null).length,
    axes: axes.map(axis => {
      if (!paired.length) return { axis, before: null, after: null, peakTimeDifferenceMs: null };
      const before = stats("before", axis); const after = stats("after", axis);
      return { axis, before, after, peakTimeDifferenceMs: before.peak === 0 || after.peak === 0 ? null : after.peakTime - before.peakTime };
    }) };
}
