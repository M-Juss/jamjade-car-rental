// Synthetic metadata for isolated contract and retry tests only.
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
export function collectionFixture() {
  const stats = { count: 251, rejected_count: 0, mean: [0, 0, 9.81], std: [0.01, 0.01, 0.01], rms: 9.81, rate_hz: 50, max_gap_ms: 20 };
  return { contract_version: 'rc-collection-v1', recording_id: id(1), manifest_sha256: 'a'.repeat(64),
    session: { id: id(2), device_profile_id: id(3), session_number: 2, recording_group_id: id(4), opened_at: '2026-11-06T00:00:00Z',
      conditions: { surface: 'Tiles', slope: 'level' }, preset_id: 'mn82s_roof_v1', catalog_version: 'rc-exercises-v1', operator_code: 'OP01' },
    mount: { id: id(5), research_session_id: id(2), mount_number: 1, reason: 'initial', created_at: '2026-11-06T00:00:00Z', preset_id: 'mn82s_roof_v1', alignment_status: 'pending' },
    preflight: { id: id(6), mount_version_id: id(5), clock_context_id: id(7), consent_version: 'rc-preflight-v1', consented_at: '2026-11-06T00:00:01Z',
      started_at: '2026-11-06T00:00:01Z', start_elapsed_ns: '9007199254741001', end_elapsed_ns: '9007204254741001', window_ms: 5000,
      summary_method_version: 'rest-welford-v1', criteria_version: null, holder_locked: true, phone_top_forward: true, rc_still: true,
      measurements: { accelerometer: stats, gyroscope: { ...stats, mean: [0, 0, 0], rms: 0.001 } },
      checks: { sensors: 'passed', timing: 'inconclusive', orientation: 'inconclusive', stability: 'inconclusive' }, result: 'inconclusive' },
    capture_number: 38, protocol_code: 'FSS', catalog_version: 'rc-exercises-v1', protocol_sha256: 'b'.repeat(64) };
}
