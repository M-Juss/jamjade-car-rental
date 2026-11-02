import type { NativeChannel } from "@/services/research/native-types";

export function SignalStatisticHelp({ kind, channel, count }: {
  kind: "peak" | "rms" | "gyroscope"; channel: NativeChannel; count: number;
}) {
  const gyroscope = kind === "gyroscope";
  const sensor = gyroscope ? "gyroscope" : channel === "accelerometer" ? "accelerometer"
    : channel === "linear_acceleration" ? "linear acceleration" : channel === "gravity" ? "gravity" : "rotation vector";
  const descriptions = {
    peak: "The highest X/Y/Z magnitude in this interval.",
    rms: "RMS summarizes all magnitudes in this interval, giving larger values more weight.",
    gyroscope: "RMS combines all X/Y/Z rotation readings; closer to zero means less rotation overall.",
  };
  return <>
    <p>{descriptions[kind]}</p>
    <div className="space-y-2 rounded-md bg-muted p-3 font-mono">
      <p>mᵢ = √(Xᵢ² + Yᵢ² + Zᵢ²)</p>
      <p>{kind === "peak" ? "Peak = max(m₁, …, mₙ)" : "RMS = √((m₁² + … + mₙ²) / n)"}</p>
    </div>
    <p className="text-muted-foreground">Xᵢ/Yᵢ/Zᵢ = one {sensor} reading; mᵢ = its magnitude; n = {count.toLocaleString()} valid readings.</p>
    {gyroscope ? <p className="text-muted-foreground">rad/s measures rotation rate, not travel speed or total angle.</p>
      : channel === "accelerometer" || channel === "gravity" ? <p className="text-muted-foreground">Includes gravity: a resting phone can read about 9.8 m/s².</p>
      : channel === "rotation_vector" ? <p className="text-muted-foreground">Uses unitless XYZ components, not acceleration or degrees.</p>
      : <p className="text-muted-foreground">Android&apos;s acceleration estimate with gravity removed (m/s²).</p>}
  </>;
}
