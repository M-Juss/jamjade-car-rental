import assert from 'node:assert/strict';
import test from 'node:test';

import { canRecordTestVehicle, previousVehiclePreviewStep, TEST_VEHICLES, VEHICLE_PREVIEW_STEPS } from './collection-workflow.ts';

test('only RC Pilot enables collection across every offered vehicle category', () => {
  assert.equal(TEST_VEHICLES.length, 4);
  for (const vehicle of TEST_VEHICLES) {
    assert.equal(canRecordTestVehicle(vehicle.id), vehicle.id === 'rc_pilot');
  }
  for (const value of [null, undefined, '', 'real_vehicle', 'RC Pilot', {}, 4]) {
    assert.equal(canRecordTestVehicle(value), false);
  }
});

test('preview Back visits the previous step and exits only from road selection', () => {
  assert.equal(previousVehiclePreviewStep('road'), null);
  for (let index = 1; index < VEHICLE_PREVIEW_STEPS.length; index++) {
    assert.equal(previousVehiclePreviewStep(VEHICLE_PREVIEW_STEPS[index]), VEHICLE_PREVIEW_STEPS[index - 1]);
  }
});
