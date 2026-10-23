import { Activity, ChevronDown, ChevronUp, Compass, Move3D, RotateCcw } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { InfoRow } from '@/components/bookings';
import { CalibrationSensorReading } from '@/components/telematics/CalibrationSensorReading';
import { themeColors } from '@/constants/theme';
import type { RcSample, RcSummary } from '@/lib/research/rc-research';

function AxisReadings({ title, values, unit }: { title: string; values?: number[]; unit: string }) {
  return <View className="gap-2 py-3">
    <Text className="font-sans text-caption font-semibold text-foreground">{title}</Text>
    <View className="flex-row gap-3">{['X', 'Y', 'Z'].map((axis, index) => <View className="min-w-0 flex-1" key={axis}>
      <Text className="font-sans text-caption text-secondary-foreground">{axis}</Text>
      <Text className="font-sans text-body font-semibold text-foreground">{values ? values[index].toFixed(2) : '—'}</Text>
      <Text className="font-sans text-caption text-secondary-foreground">{unit}</Text>
    </View>)}</View>
  </View>;
}

export function RcReadingSummary({ summary, sample }: { summary?: RcSummary; sample?: RcSample }) {
  return <View className="gap-3">
    <View className="flex-row gap-3">
      <CalibrationSensorReading label="Accelerometer" icon={Activity} value={summary?.linear_rms} unit="m/s² RMS" state="neutral" caption="Across recording" />
      <CalibrationSensorReading label="Gyroscope" icon={RotateCcw} value={summary?.rotation_peak} unit="°/s peak" state="neutral" caption="Across recording" />
    </View>
    <View className="flex-row gap-3">
      <CalibrationSensorReading label="Tilt change" icon={Compass} value={summary?.max_tilt_degrees} unit="degrees" state="neutral" caption="From initial gravity" />
      <CalibrationSensorReading label="Gravity" icon={Move3D} value={summary ? Math.hypot(...summary.gravity_mean) : undefined} unit="m/s²" state="neutral" caption="Mean magnitude" />
    </View>
    <View className="rounded-card border border-border bg-surface p-card">
      <AxisReadings title={sample ? 'Acceleration · latest' : 'Acceleration · mean'}
        values={sample ? [sample.linear_x, sample.linear_y, sample.linear_z] : summary?.linear_mean} unit="m/s²" />
      <AxisReadings title={sample ? 'Rotation · latest' : 'Rotation · mean'}
        values={sample ? [sample.rotation_x, sample.rotation_y, sample.rotation_z] : summary?.rotation_mean} unit="°/s" />
      <AxisReadings title="Gravity · mean" values={summary?.gravity_mean} unit="m/s²" />
      <View className="border-t border-border pt-1">
        <InfoRow label="Samples" value={summary ? String(summary.sample_count) : '—'} />
        <InfoRow label="Actual sampling rate" value={summary ? `${summary.mean_rate_hz.toFixed(1)} Hz` : '—'} />
        <InfoRow label="Longest sample gap" value={summary ? `${summary.max_gap_ms.toFixed(0)} ms` : '—'} />
        <InfoRow label="Duration" value={summary ? `${(summary.duration_ms / 1000).toFixed(1)} s` : '—'} />
      </View>
    </View>
  </View>;
}

export function RcRecordingDataCard({ summary }: { summary: RcSummary }) {
  const [expanded, setExpanded] = useState(false);
  return <View className="rounded-card border border-border bg-surface p-3">
    <View className="flex-row items-center justify-between gap-2">
      <Text className="font-sans min-w-0 flex-1 text-section font-semibold text-foreground">Recording data</Text>
      <Pressable accessibilityRole="button" aria-expanded={expanded} accessibilityLabel="Recording data details"
        onPress={() => setExpanded(value => !value)} className="min-h-control flex-row items-center gap-1 px-2">
        <Text className="font-sans text-caption font-semibold text-primary">Details</Text>
        {expanded ? <ChevronUp size={18} color={themeColors.primary} /> : <ChevronDown size={18} color={themeColors.primary} />}
      </Pressable>
    </View>
    {expanded ? <View className="mt-2 border-t border-border pt-3">
      <RcReadingSummary summary={summary} />
    </View> : null}
  </View>;
}
