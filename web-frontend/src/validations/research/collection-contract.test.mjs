import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import Ajv from "ajv";

// Design-contract checks, not a new runtime API validator or frontend test framework.
// Ajv is already installed by this application's ESLint toolchain; no dependency
// or application bundle change is needed to check these repository-owned schemas.
const read = name => JSON.parse(readFileSync(new URL(`../../../../docs/contracts/rc-collection-v1/${name}.json`, import.meta.url), "utf8"));
const schema = read("schema"), catalog = read("catalog"), example = read("example");
const ajv = new Ajv({ allErrors: true, schemaId: "auto" });
ajv.addSchema(schema);
const validate = ajv.getSchema(schema.$id);
const catalogValid = ajv.getSchema(`${schema.$id}#/definitions/catalog`);
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
  : value !== null && typeof value === "object" ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
  : JSON.stringify(value);
const change = (path, value) => {
  const copy = structuredClone(example), keys = path.split(".");
  const key = keys.pop(); let target = copy;
  for (const part of keys) target = target[part];
  target[key] = value;
  return copy;
};

test("Phase 1 catalog and synthetic specimen satisfy the design schemas", () => {
  assert.equal(catalogValid(catalog), true, JSON.stringify(catalogValid.errors));
  assert.equal(validate(example), true, JSON.stringify(validate.errors));
  assert.equal(example.synthetic, true);
});

test("the abbreviation guide and every recorded protocol snapshot have one defined meaning", () => {
  const codes = catalog.protocols.map(p => p.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.deepEqual(codes, schema.definitions.protocol.properties.code.enum);
  const steps = ["precheck", "initial_rest", "exercise", "final_rest", "save", "observe", "upload"];
  for (const protocol of catalog.protocols) {
    assert.deepEqual(protocol.steps.map(p => p.stage), steps);
    assert.equal(protocol.validation_status, "provisional");
    assert.equal(protocol.quiet_time_guidance_ms, 5000);
    assert.equal(typeof protocol.requires_course_rehearsal, "boolean");
  }
  const protocol = catalog.protocols.find(p => p.code === example.recording.protocol_code);
  assert.equal(createHash("sha256").update(canonical(protocol)).digest("hex"), example.recording.protocol_snapshot_sha256);
  assert.equal(protocol.recording_kind, example.recording.recording_kind);
  assert.equal(protocol.planned_assessment, example.recording.planned_assessment);
  const pad = (value, length) => String(value).padStart(length, "0");
  assert.equal(example.recording.display_code, `S${pad(example.session.session_number, 2)}-${protocol.code}-R${pad(example.recording.recording_number, 3)}`);
});

test("the fixed preset, neutral reverse stop and unmeasured geometry remain explicit", () => {
  assert.equal(catalog.preset.phone_top_toward_rc_front, true);
  assert.equal(catalog.preset.screen_facing, "up");
  assert.equal(catalog.preset.mount_angle_degrees, null);
  assert.ok(Object.values(catalog.preflight_thresholds).every(value => value === null));
  assert.equal(catalog.protocols.find(p => p.code === "RSS").expected_stop_method, "neutral_release");
  assert.equal(catalog.protocols.find(p => p.code === "SW").planned_assessment, "unspecified");
  assert.equal(example.recording.course_layout.turn_radius_m, null);
});

test("protocol snapshot hashes agree with the existing Laravel canonical serializer", () => {
  const php = spawnSync("php", ["-r", `require '../backend/vendor/autoload.php';
    $items=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
    echo json_encode(array_map(fn($item)=>hash('sha256',App\\Support\\RcNativeProtocol::canonical($item)),$items),JSON_THROW_ON_ERROR);`],
  { input: JSON.stringify(catalog.protocols), encoding: "utf8" });
  assert.equal(php.status, 0, php.stderr);
  assert.deepEqual(JSON.parse(php.stdout), catalog.protocols.map(p => createHash("sha256").update(canonical(p)).digest("hex")));
});

test("the synthetic example demonstrates identity and revision links without replacing source data", () => {
  assert.equal(example.recording.research_session_id, example.session.id);
  assert.equal(example.mount.research_session_id, example.session.id);
  assert.equal(example.recording.mount_version_id, example.mount.id);
  assert.equal(example.recording.preflight_id, example.preflight.id);
  assert.equal(example.preflight.mount_version_id, example.mount.id);
  assert.equal(example.preflight.clock_context_id, example.recording.clock_context_id);
  assert.equal(Number(BigInt(example.preflight.end_elapsed_ns) - BigInt(example.preflight.start_elapsed_ns)) / 1e6, example.preflight.window_ms);
  for (const resource of [example.observations, example.labels, example.dataset_review]) assert.equal(resource.recording_id, example.recording.recording_id);
  assert.equal(example.labels.original_manifest_sha256, example.recording.original_manifest_sha256);
  assert.equal(example.dataset_review.original_manifest_sha256, example.recording.original_manifest_sha256);
  assert.notEqual(example.recording.original_name, example.recording.display_code);
  assert.equal(example.recording.source_protocol_version, 2);
  assert.equal(example.dataset_review.decision, "pending");
  let previous = 0;
  for (const interval of example.labels.intervals) {
    assert.ok(interval.start_ms >= previous && interval.end_ms > interval.start_ms);
    assert.ok(interval.end_ms <= example.recording.duration_ms);
    previous = interval.end_ms;
  }
});

test("reviewed labels can retain approximate boundaries without pretending confidence in signals-only labels", () => {
  const value = change("labels.review_status", "reviewed");
  value.labels.reviewed_at = "2026-11-05T10:04:00Z";
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.equal(value.labels.intervals[0].boundary_confidence, "approximate");
  value.labels.intervals[0].source = "signal_review";
  assert.equal(validate(value), false);
  value.labels.intervals[0].movement_confidence = "uncertain";
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
});

test("a harsh attempt can retain an honestly observed normal outcome", () => {
  const value = structuredClone(example), protocol = catalog.protocols.find(p => p.code === "HA");
  value.recording.protocol_code = "HA";
  value.recording.planned_assessment = "harsh_attempt";
  value.recording.display_code = "S02-HA-R038";
  value.recording.protocol_snapshot_sha256 = createHash("sha256").update(canonical(protocol)).digest("hex");
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.equal(value.labels.intervals[0].severity, "normal");
});

test("reverse protocol and observations preserve the neutral-release stopping method", () => {
  const value = structuredClone(example), protocol = catalog.protocols.find(p => p.code === "RSS");
  value.recording.protocol_code = "RSS";
  value.recording.display_code = "S02-RSS-R038";
  value.recording.protocol_snapshot_sha256 = createHash("sha256").update(canonical(protocol)).digest("hex");
  value.observations.actual_stop_method = "neutral_release";
  value.labels.intervals[0].direction = "reverse";
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.equal(value.labels.intervals[0].severity, "normal");
});

test("measured or tile-count geometry is explicit without inventing other dimensions", () => {
  const value = structuredClone(example);
  value.recording.course_layout.measurement_method = "tile_count";
  value.recording.course_layout.tile_count = 8;
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.equal(value.recording.course_layout.lane_length_m, null);
  value.recording.course_layout.measurement_method = "measured";
  value.recording.course_layout.lane_length_m = 3;
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.equal(value.recording.course_layout.turn_radius_m, null);
});

for (const [path, value] of [
  ["session.id", "not-an-id"], ["session.session_number", 0],
  ["session.closed_at", "2026-11-05T10:02:00Z"],
  ["mount.alignment_status", "accepted"], ["mount.alignment_status", "invalidated"],
  ["preflight.result", "passed"], ["preflight.accelerometer_events", -1],
  ["preflight.start_elapsed_ns", 9007199254741000],
  ["preflight.metrics.acceleration_std_xyz_mps2", [0, -1, 0]],
  ["preflight.metrics.rest_acceleration_mean_xyz_mps2", [0, 9.81]],
  ["recording.display_code", "S02-FSS-RO38"], ["recording.display_code", "S02 - FSS - R038"],
  ["recording.source_protocol_version", 1], ["recording.protocol_code", "invented"],
  ["recording.protocol_code", "HA"], ["recording.planned_assessment", "harsh_attempt"],
  ["recording.recording_kind", "forward_reference"], ["recording.server_recording_id", null],
  ["recording.course_layout.lane_length_m", 5], ["recording.course_layout.turn_radius_m", 0],
  ["recording.course_layout.measurement_method", "measured"],
  ["observations.flags", ["cone_contact", "cone_contact"]], ["observations.flags", ["auto_harsh"]],
  ["labels.review_status", "reviewed"], ["labels.version", "rc-phase-labels-v1"],
  ["labels.intervals.0.movement", "stationary"], ["labels.intervals.0.direction", "not_applicable"],
  ["labels.intervals.0.certainty", "reviewed"], ["labels.intervals.0.end_ms", 86400001],
  ["processing_profile.validation_status", "validated"], ["processing_profile.cutoff_hz", 7],
  ["dataset_review.decision", "included"], ["dataset_review.decision", "excluded"],
]) test(`design contract rejects invalid ${path}: ${JSON.stringify(value)}`, () => {
  assert.equal(validate(change(path, value)), false);
});

test("a declared preflight pass requires measured metrics even with affirmative check flags", () => {
  const value = structuredClone(example);
  Object.assign(value.preflight, { result: "passed", criteria_version: "synthetic-test-criteria-1", criteria_status: "experimental",
    checks: { sensors: "pass", timing: "pass", orientation: "pass", stability: "pass" } });
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  value.preflight.metrics.gyroscope_rms_radps = null;
  assert.equal(validate(value), false);
});

test("an inclusion decision requires explicit provenance, reason and selected intervals", () => {
  const value = structuredClone(example);
  value.labels.review_status = "reviewed";
  value.labels.reviewed_at = "2026-11-05T10:04:00Z";
  value.dataset_review = { ...value.dataset_review, decision: "included", reason: "Synthetic exploratory example only",
    processing_run_id: "00000000-0000-4000-8000-000000000013", processing_profile_id: value.processing_profile.id,
    annotation_revision_id: value.labels.id, observation_revision_id: value.observations.id,
    included_intervals: [{ start_ms: 7000, end_ms: 7600 }] };
  // Shape acceptance is not eligibility: owner, reviewed labels, actual processing
  // coverage, alignment and inclusion policy must be checked by future Laravel services.
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  value.dataset_review.processing_run_id = null;
  assert.equal(validate(value), false);
});
