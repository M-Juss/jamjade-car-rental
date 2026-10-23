import type { RcIntensity, RcMovement, RcSessionSetupInput } from '@/validation/research/rc-research';

export const RC_MOVEMENTS = [
  { value: 'stationary', label: 'Stationary' }, { value: 'steady_movement', label: 'Steady movement' },
  { value: 'acceleration', label: 'Acceleration' }, { value: 'braking', label: 'Braking' },
  { value: 'left_turn', label: 'Left turn' }, { value: 'right_turn', label: 'Right turn' },
];
export const RC_INTENSITIES = [{ value: 'normal', label: 'Normal' }, { value: 'harsh', label: 'Harsh' }];
export const RC_SURFACES = ['Smooth concrete', 'Rough concrete', 'Asphalt', 'Gravel', 'Other'].map(value => ({ value, label: value }));
export const RC_SLOPES = ['level', 'uphill', 'downhill'].map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }));
export const RC_MOUNTS = ['flat', 'upright', 'tilted'].map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }));
export const RC_BATTERY = ['full', 'medium', 'low'].map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }));
export const RC_LABEL_STATUS = [{ value: 'confirmed', label: 'Confirmed' }, { value: 'uncertain', label: 'Uncertain' }];
export const RC_QUALITY = [{ value: 'usable', label: 'Usable' }, { value: 'interrupted', label: 'Interrupted' }, { value: 'mount_disturbed', label: 'Mount disturbed' }];

export function movementLabel(movement: RcMovement, intensity: RcIntensity) {
  const label = RC_MOVEMENTS.find(item => item.value === movement)?.label ?? movement;
  return intensity === 'not_applicable' ? label : `${intensity === 'normal' ? 'Normal' : 'Harsh'} ${label.toLowerCase()}`;
}

export const RC_SESSION_DEFAULTS: Partial<RcSessionSetupInput> = {
  name: '', surface: '',
  intensity: 'not_applicable', consent: false,
};

export type RcProtocol = { version: number; recording_mode: 'manual'; requested_interval_ms: number;
  minimum_duration_ms: number; max_samples: number; max_samples_json_bytes: number; consent_version: number };
export type RcResearchSession = Omit<RcSessionSetupInput, 'movement' | 'intensity' | 'consent'> & {
  phone_model: string | null; rc_model: string | null; mount_method: string | null; rc_configuration: string | null;
  id: string; platform: 'android' | 'ios'; app_version: string; added_load_g: number; protocol: RcProtocol; created_at: string;
};
export type RcSample = { elapsed_ms: number; acceleration_timestamp_s: number; gravity_timestamp_s: number; rotation_timestamp_s: number;
  linear_x: number; linear_y: number; linear_z: number; including_gravity_x: number; including_gravity_y: number; including_gravity_z: number;
  rotation_x: number; rotation_y: number; rotation_z: number; orientation: number };
export type RcSummary = { sample_count: number; duration_ms: number; sensor_duration_ms: number; mean_rate_hz: number; max_gap_ms: number;
  linear_rms: number; rotation_rms: number; rotation_peak: number; max_tilt_degrees: number;
  linear_mean: number[]; rotation_mean: number[]; gravity_mean: number[]; quality_flags: string[]; eligible_for_training?: boolean };
export type RcCaptureResult = { client_trial_id: string; started_at: string; ended_at: string; samples: RcSample[]; summary: RcSummary };
export type RcLiveReading = { phase: 'preparing' | 'recording'; summary?: RcSummary; sample?: RcSample; capacity_used?: number };
export type RcResearchTrial = { id: string; session: RcResearchSession; intended_movement: RcMovement; intended_intensity: RcIntensity;
  observed_movement: RcMovement; observed_intensity: RcIntensity; label_status: 'confirmed' | 'uncertain';
  quality: 'usable' | 'interrupted' | 'mount_disturbed'; event_start_ms: number; event_end_ms: number; notes: string | null;
  summary: RcSummary; started_at: string; ended_at: string; created_at: string };
