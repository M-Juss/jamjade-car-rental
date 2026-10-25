export type ResearchMovement = "stationary" | "steady_movement" | "acceleration" | "braking" | "left_turn" | "right_turn";
export type ResearchIntensity = "normal" | "harsh" | "not_applicable";
export type ResearchSample = {
  elapsed_ms: number;
  acceleration_timestamp_s: number;
  gravity_timestamp_s: number;
  rotation_timestamp_s: number;
  linear_x: number; linear_y: number; linear_z: number;
  including_gravity_x: number; including_gravity_y: number; including_gravity_z: number;
  rotation_x: number; rotation_y: number; rotation_z: number;
  orientation: number;
};

export type ResearchProtocol = {
  version: number;
  recording_mode: string;
  requested_interval_ms: number;
};

export type ResearchTrial = {
  id: string;
  session: {
    id: string; name: string; surface: string; slope: string;
    phone_model: string | null; rc_model: string | null;
    mount_orientation: string; mount_method: string | null;
    battery_condition: string; rc_configuration: string | null;
    platform: string; app_version: string; protocol: ResearchProtocol;
  };
  intended_movement: ResearchMovement;
  intended_intensity: ResearchIntensity;
  observed_movement: ResearchMovement;
  observed_intensity: ResearchIntensity;
  label_status: "confirmed" | "uncertain";
  quality: "usable" | "interrupted" | "mount_disturbed";
  event_start_ms: number; event_end_ms: number;
  notes: string | null;
  summary: {
    sample_count: number; duration_ms: number; sensor_duration_ms: number;
    mean_rate_hz: number; max_gap_ms: number; linear_rms: number;
    rotation_rms: number; rotation_peak: number; max_tilt_degrees: number;
    quality_flags: string[];
  };
  started_at: string; ended_at: string; created_at: string;
};

export type ResearchInspection = {
  trial: ResearchTrial;
  protocol: ResearchProtocol;
  source: "expo_device_motion_v1" | "synthetic_demo_v1";
  coordinate_frame: "phone";
  units: { acceleration: string; rotation: string; time: string };
  reference: null;
  processing: null;
  content_sha256: string;
  samples: ResearchSample[];
};

export type ResearchRecordingsPage = { recordings: ResearchTrial[]; page: number; lastPage: number; total: number };
