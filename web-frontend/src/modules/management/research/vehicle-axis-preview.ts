import type { NativeEvent } from "@/services/research/native-types";
import type { ForwardReferenceCandidate, ReferenceRange } from "./forward-reference";
import { nativeIntervalStats, nativeSignalPoints } from "./native-analysis";
import type { SignalPoint } from "./recording-analysis";
import { channelReference } from "./stationary-reference";

export const VEHICLE_PREVIEW_VERSION = "fixed-vehicle-frame-v1";
const dot = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const vector = (value: number[]) => value.length === 3 && value.every(Number.isFinite);

export function vehicleAxisIntervalStats(acceleration: SignalPoint[], rotation: SignalPoint[], range: ReferenceRange) {
  const gyro = nativeIntervalStats(rotation, ...range);
  const upRotationRms = gyro ? Math.sqrt(rotation.filter(point => point.time >= range[0] && point.time <= range[1] && point.z !== null)
    .reduce((sum, point) => sum + point.z! ** 2, 0) / gyro.count) : null;
  return { acceleration: nativeIntervalStats(acceleration, ...range), rotation: gyro, upRotationRms };
}

/** Local fixed-frame diagnostic. Neither acceleration mode is dynamic gravity removal. */
export function vehicleAxisPreview(acceleration: NativeEvent[], gyroscope: NativeEvent[], origin: string,
  bounds: ReferenceRange, reference: ForwardReferenceCandidate) {
  try {
    if (!bounds.every(Number.isFinite) || bounds[0] < 0 || bounds[1] <= bounds[0] || bounds[1] - bounds[0] > 30000) {
      throw new Error("Load a signal window of at most 30 seconds for the vehicle preview.");
    }
    const matrix = reference.rotationRfu;
    // Reject invalid frames; never silently normalize an incorrect candidate.
    if (matrix.length !== 3 || !matrix.every(vector) || matrix.some((row, i) => matrix.some((other, j) =>
      Math.abs(dot(row, other) - (i === j ? 1 : 0)) > 1e-6))) {
      throw new Error("The candidate rotation is not an orthonormal frame.");
    }
    const [r, f, u] = matrix;
    const determinant = r[0] * (f[1] * u[2] - f[2] * u[1]) - r[1] * (f[0] * u[2] - f[2] * u[0]) + r[2] * (f[0] * u[1] - f[1] * u[0]);
    if (Math.abs(determinant - 1) > 1e-6) throw new Error("The candidate rotation must be right-handed.");
    const rest = reference.phases.find(phase => phase.phase === "rest");
    if (!rest || !vector(rest.acceleration.mean) || !vector(rest.gyroscope.mean)) {
      throw new Error("The candidate resting reference is unavailable.");
    }
    const epoch = BigInt(origin);
    const accel = channelReference(acceleration, epoch, ...bounds, "Accelerometer");
    const gyro = channelReference(gyroscope, epoch, ...bounds, "Gyroscope");
    const windowPoints = (events: NativeEvent[]) => nativeSignalPoints(events.filter(event => {
      const time = Number(BigInt(event.sensor_timestamp_ns) - epoch) / 1e6;
      return time >= bounds[0] && time <= bounds[1];
    }), origin);
    const project = (points: SignalPoint[], offset: number[]): SignalPoint[] => points.map(point => {
      if (point.x === null || point.y === null || point.z === null) return { ...point };
      const values = [point.x, point.y, point.z].map((value, i) => value - offset[i]);
      const rfu = matrix.map(row => dot(row, values));
      if (!rfu.every(Number.isFinite)) throw new Error("Projected values exceed the supported numeric range.");
      // Chart keys are presentation slots: Forward, Right, Up. Matrix rows remain RFU.
      return { time: point.time, x: rfu[1], y: rfu[0], z: rfu[2] };
    });
    const accelPoints = windowPoints(acceleration);
    return { available: true as const,
      includingGravity: project(accelPoints, [0, 0, 0]),
      relativeToRest: project(accelPoints, rest.acceleration.mean),
      rotation: project(windowPoints(gyroscope), rest.gyroscope.mean),
      accelerationTiming: accel.summary, gyroscopeTiming: gyro.summary };
  } catch (error) {
    return { available: false as const, reason: error instanceof Error && error.name === "Error" ? error.message : "The vehicle preview could not read this window." };
  }
}
