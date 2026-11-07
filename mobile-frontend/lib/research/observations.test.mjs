import assert from 'node:assert/strict';
import test from 'node:test';
import { observationFormValues, observationSaveError } from './observations.ts';

test('first observation can preserve uncertainty without any flags', () => {
  assert.deepEqual(observationFormValues(), { base_revision: 0, completed_as_planned: null,
    source: 'operator_report', observer_code: null, flags: [], actual_stop_method: 'unknown', notes: null });
});

test('saved observations reset to the acknowledged revision without mixing persisted metadata into the form', () => {
  const saved = { id: 'synthetic-id', revision: 3, reported_at: '2026-11-06T00:00:00Z', completed_as_planned: false,
    source: 'observed', observer_code: 'OB01', flags: ['steering_corrections'], actual_stop_method: 'brake_applied', notes: 'Observed trial' };
  const values = observationFormValues(saved);
  assert.equal(values.base_revision, 3);
  assert.equal(values.completed_as_planned, false);
  assert.equal(values.observer_code, 'OB01');
  assert.equal('id' in values, false);
  assert.equal('reported_at' in values, false);
  values.flags.push('bump');
  assert.deepEqual(saved.flags, ['steering_corrections']);
});

test('save failures give safe local recovery instructions without exposing raw native details', () => {
  assert.match(observationSaveError(new Error('Research access expired.')), /verify access/);
  assert.match(observationSaveError(new Error('Observations changed.')), /Reopen/);
  assert.match(observationSaveError(new Error('Saved observations could not be confirmed.')), /Reopen/);
  assert.match(observationSaveError(new Error('Another action is finishing.')), /finishing/);
  const message = observationSaveError(new Error('/private/synthetic-path credential=synthetic'));
  assert.match(message, /original is kept/);
  assert.equal(message.includes('synthetic'), false);
  assert.equal(observationSaveError(null), message);
});
