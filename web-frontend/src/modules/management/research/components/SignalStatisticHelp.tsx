import type { NativeChannel } from "@/services/research/native-types";

export function SignalStatisticHelp({ kind, channel, count }: {
  kind: "peak" | "rms" | "gyroscope"; channel: NativeChannel; count: number;
}) {
  const gyroscope = kind === "gyroscope";
  const sensor = gyroscope ? "gyroscope" : channel === "accelerometer" ? "accelerometer"
    : channel === "linear_acceleration" ? "linear acceleration" : channel === "gravity" ? "gravity" : "rotation vector";
  const descriptions = {
    peak: "The largest combined X/Y/Z magnitude from one reading in the selected interval.",
    rms: "Root mean square (RMS) summarizes the overall magnitude across all readings in the selected interval. Larger readings have more influence.",
    gyroscope: "Root mean square (RMS) summarizes rotation around all three phone axes across the selected interval. Closer to zero means less rotational activity overall.",
  };
  return <>
    <p>{descriptions[kind]}</p>
    <div className="space-y-2 rounded-md bg-muted p-3 font-mono">
      <p>mᵢ = √(Xᵢ² + Yᵢ² + Zᵢ²)</p>
      <p>{kind === "peak" ? "Peak = max(m₁, …, mₙ)" : "RMS = √((m₁² + … + mₙ²) / n)"}</p>
    </div>
    <p className="text-muted-foreground">Xᵢ, Yᵢ and Zᵢ come from the same {sensor} reading. mᵢ is its magnitude. n = {count.toLocaleString()} valid {sensor} readings in this selection.</p>
    {gyroscope ? <p className="text-muted-foreground">Measured in rad/s. This describes rotation rate, not travel speed or total angle turned.</p>
      : channel === "accelerometer" || channel === "gravity" ? <p className="text-muted-foreground">This channel includes gravity. A resting phone can have a magnitude near 9.8 m/s².</p>
      : channel === "rotation_vector" ? <p className="text-muted-foreground">Uses only the first three rotation-vector components. Values are unitless, not acceleration or angles in degrees.</p>
      : <p className="text-muted-foreground">Measured in m/s², using Android&apos;s gravity-removed acceleration estimate.</p>}
  </>;
}
