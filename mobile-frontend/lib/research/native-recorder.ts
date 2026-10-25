export const NATIVE_MOUNT_METHOD = 'Adjustable screw' as const;

export function nativeCollectionGroupName(
  conditions: { surface: string; slope: 'level' | 'uphill' | 'downhill' },
  groups: Pick<NativeCollectionGroup, 'name'>[],
): string {
  const surface = conditions.surface.trim();
  if (!surface) return '';
  const slope = { level: 'Level', uphill: 'Uphill', downhill: 'Downhill' }[conditions.slope];
  const existing = new Set(groups.map(group => group.name.toLowerCase()));
  for (let number = 1; ; number++) {
    const suffix = ` - ${slope} - Group ${String(number).padStart(2, '0')}`;
    const name = `${surface.slice(0, 100 - suffix.length).trimEnd()}${suffix}`;
    if (!existing.has(name.toLowerCase())) return name;
  }
}

export type NativeChannelStats = {
  received_count: number | null; persisted_count: number; rejected_count: number | null;
  not_durable_count: number | null; rate_hz: number | null; max_gap_ms: number | null;
  duplicate_timestamps: number; backwards_timestamps: number;
};
export type NativeChannel = {
  sensor_type: number; availability: 'available' | 'registered' | 'registration_failed' | 'unavailable' | 'no_data';
  unit: string; statistics?: NativeChannelStats;
};
export type NativeRecording = {
  recording_id: string; protocol_version: 2; source: 'android_sensor_manager_v2';
  state: 'preparing' | 'recording' | 'stopping' | 'stopped' | 'interrupted' | 'unavailable';
  started_at_utc: string | null; ended_at_utc: string | null; duration_ms: number | null;
  context: { name?: string; recording_kind?: string; surface?: string; rc_model?: string;
    recording_group_id?: string; recording_group_name?: string; recording_number?: number; mount_method?: string; mount_orientation?: string };
  device?: { model?: string; manufacturer?: string };
  phone_power?: { start: NativePhonePower; latest: NativePhonePower; end: NativePhonePower | null };
  channels: Record<string, NativeChannel>; end_reason: string | null;
  annotation_state: 'unlabeled'; transfer_state: 'local_only'; integrity: string | null; diagnostics_partial: boolean;
};
export type NativePhonePower = { battery_percent: number | null; charging: boolean | null; battery_saver: boolean | null; elapsed_ns: string };
export type NativeCollectionGroup = {
  id: string; name: string; preset_id: string; created_at_utc: string; next_recording_number: number;
  defaults: { surface: string; slope: 'level' | 'uphill' | 'downhill'; mount_method: string;
    recording_kind: 'maneuver_trial' | 'stationary_reference' | 'forward_reference' };
};
export type NativeGroupCatalog = { groups: NativeCollectionGroup[]; selected_group_id: string | null;
  preset: { id: string; label: string; rc_model: string; mount_orientation: 'tilted'; mount_location: 'upper_roof'; screen_facing: 'up' } };
export type NativeRecorderState = { active: boolean; preparing: boolean; error: string | null; current: NativeRecording | null; phone_power?: NativePhonePower };
export const NATIVE_RECORDING_PURPOSES = [
  { value: 'maneuver_trial', label: 'Maneuver trial' }, { value: 'stationary_reference', label: 'Stationary reference capture' },
  { value: 'forward_reference', label: 'Forward reference capture' },
];
export const NATIVE_CHANNEL_LABELS: Record<string, string> = {
  accelerometer: 'Accelerometer', gyroscope: 'Gyroscope', gravity: 'Gravity',
  linear_acceleration: 'Linear acceleration', rotation_vector: 'Rotation vector',
};
export const NATIVE_END_REASONS: Record<string, string> = {
  operator_stopped: 'Stopped by operator', task_removed: 'App removed from recents', signed_out: 'Signed out',
  account_changed: 'Account changed', authorization_expired: 'Research access expired', storage_limit: 'Storage limit reached',
  required_sensor_no_data: 'Required sensor returned no data', required_sensor_stalled: 'Required sensor stopped delivering',
  write_failed: 'Storage write interrupted', start_failed: 'Capture could not start', runtime_interrupted: 'Recording interrupted',
  service_interrupted: 'Recording service interrupted', key_or_file_unavailable: 'Recording cannot be unlocked or read',
  rejection_limit: 'Repeated invalid sensor events',
  notifications_disabled: 'Recording notifications disabled',
};
