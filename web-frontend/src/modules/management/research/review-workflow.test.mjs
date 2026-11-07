import assert from 'node:assert/strict';
import test from 'node:test';
import { boundedSelection, referenceRequirement, timingWarnings } from './review-workflow.ts';

test('missing or unprepared references block vehicle-axis processing without blocking original labels', () => {
  for (const status of ['missing', 'needs_processing']) {
    const result = referenceRequirement({ review: { processing: { reference_status: status } } });
    assert.equal(result.blocked, true);
    assert.ok(result.message);
  }
  for (const status of ['not_required', 'review_required']) {
    assert.deepEqual(referenceRequirement({ review: { processing: { reference_status: status } } }), { blocked: false, message: null });
  }
});
test('shared interval selection clips overlapping windows and resets disjoint windows', () => {
  assert.deepEqual(boundedSelection([5000, 10000], [0, 18000]), [5000, 10000]);
  assert.deepEqual(boundedSelection([5000, 10000], [8000, 18000]), [8000, 10000]);
  assert.deepEqual(boundedSelection([5000, 10000], [30000, 60000]), [30000, 60000]);
});
test('timing review reports observed faults without inventing rate or gap acceptance thresholds', () => {
  const healthy = { sequence_gaps: 0, duplicate_timestamps: 0, backwards_timestamps: 0, out_of_interval: 0, max_gap_ms: 250, rate_hz: 25 };
  assert.deepEqual(timingWarnings({ recording: { summary: { accelerometer: healthy } } }), []);
  assert.deepEqual(timingWarnings({ recording: { summary: { accelerometer: healthy, gyroscope: { ...healthy, sequence_gaps: 1 } } } }), ['gyroscope']);
});
