import { Radio } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { InfoRow, SectionCard } from '@/components/bookings';
import { recordingTitle } from '@/lib/research/collection';
import { NATIVE_CHANNEL_LABELS, NATIVE_END_REASONS, type NativeRecording } from '@/lib/research/native-recorder';

export function NativeRecordingDetails({ recording }: { recording: NativeRecording }) {
  const reason = recording.end_reason ? NATIVE_END_REASONS[recording.end_reason] ?? 'Recording ended' : null;
  return <SectionCard title={recordingTitle(recording)} icon={Radio}>
    <InfoRow label="State" value={recording.state} /><InfoRow label={recording.diagnostics_partial ? 'Recovered span' : 'Duration'} value={`${((recording.duration_ms ?? 0) / 1000).toFixed(1)} s`} />
    {reason && <InfoRow label="Ended" value={reason} />}
    <InfoRow label="Storage" value="Encrypted on this phone" />
    {recording.context?.recording_group_id && <>
      <InfoRow label="Collection group" value={recording.context.recording_group_name ?? 'Unknown'} />
      <InfoRow label="Group ID" value={recording.context.recording_group_id} />
      <InfoRow label="Recording number" value={String(recording.context.recording_number ?? 'Unknown')} />
    </>}
    {recording.device?.model && <InfoRow label="Phone" value={recording.device.model} />}
    {recording.phone_power && <>
      <InfoRow label="Battery at start" value={recording.phone_power.start.battery_percent == null ? 'Unavailable' : `${recording.phone_power.start.battery_percent.toFixed(0)}%`} />
      <InfoRow label={recording.phone_power.end ? 'Battery at end' : 'Current battery'} value={recording.phone_power.latest.battery_percent == null ? 'Unavailable' : `${recording.phone_power.latest.battery_percent.toFixed(0)}%`} />
      <InfoRow label="Charging" value={recording.phone_power.latest.charging == null ? 'Unavailable' : recording.phone_power.latest.charging ? 'Yes' : 'No'} />
      <InfoRow label="Battery Saver" value={recording.phone_power.latest.battery_saver == null ? 'Unavailable' : recording.phone_power.latest.battery_saver ? 'On' : 'Off'} />
    </>}
    {recording.diagnostics_partial && <Text className="font-sans my-2 text-caption text-warning">Recovered measurements have incomplete capture diagnostics. A missing tail is possible.</Text>}
    {Object.entries(recording.channels ?? {}).map(([name, channel]) => <View key={name} className="mt-3 border-t border-border pt-3">
      <Text className="font-sans text-body font-semibold text-foreground">{NATIVE_CHANNEL_LABELS[name] ?? name}</Text>
      <InfoRow label="Availability" value={channel.availability.replaceAll('_', ' ')} /><InfoRow label="Saved events" value={String(channel.statistics?.persisted_count ?? 0)} />
      <InfoRow label="Delivered rate" value={channel.statistics?.rate_hz == null ? 'Not enough data' : `${channel.statistics.rate_hz.toFixed(1)} Hz`} />
      <InfoRow label="Largest sensor gap" value={channel.statistics?.max_gap_ms == null ? 'Not enough data' : `${channel.statistics.max_gap_ms.toFixed(1)} ms`} />
      {Boolean(channel.statistics?.duplicate_timestamps || channel.statistics?.backwards_timestamps || channel.statistics?.rejected_count || channel.statistics?.not_durable_count) && <Text className="font-sans my-2 text-caption text-warning">
        {channel.statistics?.duplicate_timestamps ?? 0} repeated · {channel.statistics?.backwards_timestamps ?? 0} backward · {channel.statistics?.rejected_count ?? 'Unknown'} rejected · {channel.statistics?.not_durable_count ?? 'Unknown'} unsaved
      </Text>}
      <InfoRow label="Units" value={channel.unit === 'native_rotation_vector' ? 'Unitless; heading accuracy in rad' : channel.unit} />
    </View>)}
  </SectionCard>;
}
