import type { ProcessingRequestValues, ProcessingRunValues } from "@/validations/research/processing-run";

type Point = { time: number; x: number | null; y: number | null; z: number | null };
export type ProcessedChannel = { before: Point[]; after: Point[]; warmup: boolean[]; segments: number };
type Counts = { original: number; interpolated: number; gap: number; outside: number };
type GridValue = { state: "original" | "interpolated" | "gap" | "outside"; values: number[] | null; source_times_ns: [string, string] | null };
export type ProcessingRun = { id: string; recording_id: string; reference_run_id: string | null; version: string; cutoff_hz: number; fingerprint: string; created_at: string };
export type ReferenceRunOption = { id: string; recording_id: string; recording_name: string; created_at: string; cutoff_hz: number; compatible: boolean; unavailable_reason: string | null };
export type ProcessingDetail = { run: ProcessingRun; result: {
  version: string; source: { recording_id: string; manifest_sha256: string; chunk_inventory_sha256: string; protocol_version: 2 };
  config: ProcessingRequestValues;
  reference_origin?: { run_id: string; recording_id: string; recording_name: string; version: string; run_fingerprint: string;
    payload_sha256: string; manifest_sha256: string; chunk_inventory_sha256: string; ranges: ProcessingRunValues["ranges"];
    window: [number, number]; setup_sha256: string; same_mount_confirmed: true };
  methods: { reference: string; synchronization: string; filter: string; projection: string };
  settings: { grid_ms: number; max_interpolation_ms: number; warmup_ms: number; reference_source: string; acceleration_mode: string; b: number[]; a: number[] };
  reference: { rotation_rfu: number[][]; acceleration_mean: number[]; gyroscope_mean: number[]; variance_share: number;
    angle_from_phone_top: number; stop_opposition_degrees: number | null; warnings: string[] };
  counts: { rows: number; paired: number; acceleration: Counts; gyroscope: Counts };
  rows: { time: number; sensor_timestamp_ns: string; acceleration: GridValue; gyroscope: GridValue }[];
  signals: { acceleration: ProcessedChannel; gyroscope: ProcessedChannel };
} };
