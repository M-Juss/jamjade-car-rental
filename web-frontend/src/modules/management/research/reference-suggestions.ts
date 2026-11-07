import type { NativeEvent } from "@/services/research/native-types";
import type { SignalPoint } from "./recording-analysis";
import { forwardReferencePreview, restingFrame, type ForwardRanges, type ReferenceRange } from "./forward-reference";
import { channelReference } from "./stationary-reference";

export const SUGGESTION_VERSION = "reference-sections-v1";
// Experimental offline research settings, not maneuver thresholds or proof of stillness.
const BIN_MS = 250;
const MIN_SECTION_MS = 500;
const MAX_EVENT_MS = 1000;
const MAX_REST_MS = 5000;
const dot = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
function quietLimit(values: number[]) {
  const low = [...values].sort((a, b) => a - b).slice(0, Math.max(2, Math.ceil(values.length * 0.2)));
  const center = median(low);
  // Low-tail MAD can collapse for nearly uniform noise. Keep a relative margin.
  return Math.max(1e-6, 1.5 * center, center + 6 * 1.4826 * median(low.map(value => Math.abs(value - center))));
}
function stats(points: SignalPoint[]) {
  const vectors = points.map(p => [p.x!, p.y!, p.z!]);
  const mean = [0, 1, 2].map(i => vectors.reduce((sum, v) => sum + v[i], 0) / vectors.length);
  return { mean,
    variation: Math.sqrt(vectors.reduce((sum, v) => sum + v.reduce((total, value, i) => total + (value - mean[i]) ** 2, 0), 0) / vectors.length),
    rms: Math.sqrt(vectors.reduce((sum, v) => sum + dot(v, v), 0) / vectors.length) };
}
type Bin = { range: ReferenceRange; accel: ReturnType<typeof stats>; gyro: ReturnType<typeof stats>; quiet: boolean; level: number };
function runs(bins: (Bin | null)[], matches: (bin: Bin) => boolean, minimumMs = MIN_SECTION_MS): ReferenceRange[] {
  const result: ReferenceRange[] = [];
  let current: ReferenceRange | null = null;
  for (const bin of bins) {
    if (bin && matches(bin)) {
      if (!current) current = [...bin.range]; else current[1] = bin.range[1];
    } else if (current) { if (current[1] - current[0] >= minimumMs) result.push(current); current = null; }
  }
  if (current && current[1] - current[0] >= minimumMs) result.push(current);
  return result;
}

/** Only proposes sections of one rest/start/stop pilot. Operator review remains mandatory. */
export function suggestForwardIntervals(acceleration: NativeEvent[], gyroscope: NativeEvent[], origin: string, bounds: ReferenceRange, minimumEventMs: 250 | 500 = 500) {
  try {
    if (!bounds.every(Number.isFinite) || bounds[0] < 0 || bounds[1] - bounds[0] < 2500 || bounds[1] - bounds[0] > 30000) {
      throw new Error("Load at least 2.5 seconds, up to 30 seconds, to suggest reference sections.");
    }
    const epoch = BigInt(origin);
    const accel = channelReference(acceleration, epoch, ...bounds, "Accelerometer");
    const gyro = channelReference(gyroscope, epoch, ...bounds, "Gyroscope");
    // Refuse unknown delivery holes rather than create a continuous-looking suggestion.
    for (const channel of [accel.summary, gyro.summary]) {
      if (channel.largestGapMs > BIN_MS / 2 || channel.leadingGapMs > BIN_MS || channel.trailingGapMs > BIN_MS) {
        throw new Error("Timing gaps need review. Select the reference sections manually.");
      }
    }
    const count = Math.ceil((bounds[1] - bounds[0]) / BIN_MS);
    const bucket = (points: SignalPoint[]) => {
      const groups: SignalPoint[][] = Array.from({ length: count }, () => []);
      for (const point of points) groups[Math.min(count - 1, Math.floor((point.time - bounds[0]) / BIN_MS))].push(point);
      return groups;
    };
    const a = bucket(accel.points); const g = bucket(gyro.points);
    const bins: (Bin | null)[] = a.map((points, index) => {
      const start = bounds[0] + index * BIN_MS; const end = Math.min(bounds[1], start + BIN_MS);
      if (end - start < 200 || [points, g[index]].some(group => group.length < 3 || group[0].time - start > BIN_MS / 2 || end - group.at(-1)!.time > BIN_MS / 2)) return null;
      return { range: [start, end], accel: stats(points), gyro: stats(g[index]), quiet: false, level: 0 };
    });
    const usable = bins.filter((bin): bin is Bin => bin !== null);
    if (usable.length < 8) throw new Error("Not enough continuous sensor data to suggest three sections.");
    const accelLimit = quietLimit(usable.map(bin => bin.accel.variation));
    const gyroLimit = quietLimit(usable.map(bin => bin.gyro.rms));
    for (let index = 0; index < bins.length; index++) {
      const bin = bins[index];
      if (!bin) continue;
      // A step exactly on a bin edge can have zero within-bin variation.
      const neighbors = [bins[index - 1], bins[index + 1]].filter((neighbor): neighbor is Bin => !!neighbor);
      const stableMean = neighbors.every(neighbor => Math.hypot(...bin.accel.mean.map((value, axis) => value - neighbor.accel.mean[axis])) <= 3 * accelLimit);
      bin.quiet = bin.accel.variation <= accelLimit && bin.gyro.rms <= gyroLimit && stableMean;
    }
    const quietRuns = runs(bins, bin => bin.quiet);
    // FSS timing only: a locally stable terminal segment can settle at a new
    // baseline. Permit at most 750 ms of end handling/partial-bin exclusion.
    // Quiet IMU readings remain a proposal, never proof of standstill.
    const terminalQuiet = minimumEventMs === 250
      ? quietRuns.filter(range => bounds[1] - range[1] <= 3 * BIN_MS).at(-1) : undefined;
    const anchor = quietRuns[0];
    if (!anchor) throw new Error("No clear resting section found. Review the signal and select intervals manually.");
    const resting = channelReference(acceleration, epoch, ...anchor, "Accelerometer");
    const { top } = restingFrame(resting.summary.mean);
    const restingValues = resting.points.map(p => dot([p.x!, p.y!, p.z!], top));
    const meanLevel = dot(resting.summary.mean, top);
    const levelLimit = Math.max(1e-6, 6 * Math.sqrt(restingValues.reduce((sum, v) => sum + (v - meanLevel) ** 2, 0) / restingValues.length));
    for (const bin of usable) bin.level = dot(bin.accel.mean, top) - meanLevel;
    const active = (bin: Bin) => (!terminalQuiet || bin.range[1] <= terminalQuiet[0])
      && (!bin.quiet || Math.abs(bin.level) > 3 * levelLimit);
    const positive = runs(bins, bin => bin.range[0] >= anchor[1] && active(bin) && bin.level > levelLimit, minimumEventMs);
    const first = positive[0];
    if (!first) throw new Error("No clear forward-start section found. Check the mount and review the intervals manually.");
    const negative = runs(bins, bin => bin.range[0] >= first[1] && active(bin) && bin.level < -levelLimit, minimumEventMs);
    const last = negative.at(-1);
    if (!last) throw new Error("No clear opposite stopping section found. Review the intervals manually.");
    const after = minimumEventMs === 250
      ? terminalQuiet && terminalQuiet[0] >= last[1] ? terminalQuiet : undefined
      : runs(bins, bin => bin.quiet && Math.abs(bin.level) <= 3 * levelLimit && bin.range[0] >= last[1])[0];
    // A quiet cruise between the first start and the last stop is not a second trial.
    const repeated = negative.some(stop => positive.some(start => start[0] >= stop[1] && start[1] <= last[0]
      && quietRuns.some(quiet => quiet[0] >= stop[1] && quiet[1] <= start[0])));
    if (repeated) throw new Error("Several start/stop candidates are present. Choose one trial manually.");
    const before = quietRuns.filter(range => range[1] <= first[0]).sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]))[0];
    if (!before) throw new Error("No resting section before the start. Choose the intervals manually.");
    const ranges: ForwardRanges = { rest: [Math.max(before[0], before[1] - MAX_REST_MS), before[1]],
      starting: [first[0], Math.min(first[1], first[0] + MAX_EVENT_MS)],
      stopping: [Math.max(last[0], last[1] - MAX_EVENT_MS), last[1]] };
    // Reference preparation still requires its existing 500 ms fitting checks.
    // Short FSS timing proposals do not fit or certify a new coordinate frame.
    if (minimumEventMs === 500) {
      const check = forwardReferencePreview(acceleration, gyroscope, origin, ranges, bounds);
      if (!check.available) throw new Error(check.reason);
      if (check.angleFromPhoneTop >= 90 || check.phases[2].forwardMean >= 0) throw new Error("The suggested start and stop are inconsistent. Review them manually.");
    }
    return { available: true as const, ranges, quietAfter: after ?? null,
      diagnostics: { accelLimit, gyroLimit, levelLimit, binMs: BIN_MS },
      notes: after ? [] : ["No continuous quiet section after braking."] };
  } catch (error) {
    return { available: false as const, reason: error instanceof Error && error.name === "Error" ? error.message : "Sensor timestamps could not be read." };
  }
}
