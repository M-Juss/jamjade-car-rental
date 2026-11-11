import assert from 'node:assert/strict';
import test from 'node:test';

import { CALIBRATION_CHECK_ORDER, deviceSetupProgress, handoverStatusCopy, resolveSetupView, setupOverview, SETUP_CHECK_ORDER, telematicsStage } from './setup.ts';

function handover(overrides = {}) {
  return {
    eligibility: { state: 'handover_in_progress', canWorkSetup: true },
    setup: { status: 'in_progress' },
    steps: SETUP_CHECK_ORDER.map((type) => ({ type, status: 'pending' })),
    ...overrides,
  };
}

test('a locked handover shows the waiting stage even if old device checks passed', () => {
  const current = handover({ eligibility: { state: 'rental_scheduled', canWorkSetup: false } });
  current.steps = current.steps.map((step) => ({ ...step, status: 'passed' }));
  assert.equal(telematicsStage(current), 'waiting');
});

test('staff release and release readiness take precedence over device progress', () => {
  assert.equal(telematicsStage(handover({ eligibility: { state: 'released', canWorkSetup: false }, setup: { status: 'released' } })), 'released');
  assert.equal(telematicsStage(handover({ setup: { status: 'ready_for_release' } })), 'awaiting_release');
});

test('a new eligible handover starts with device setup', () => {
  assert.equal(telematicsStage(handover()), 'device_setup');
  assert.equal(deviceSetupProgress(handover()).nextStep, 'device_check');
});

test('missing or failed device checks prevent advancement to calibration', () => {
  const current = handover();
  current.steps = current.steps.map((step) => ({ ...step, status: 'passed' }));
  current.steps = current.steps.filter((step) => step.type !== 'gps_check');
  assert.equal(telematicsStage(current), 'device_setup');
  assert.equal(deviceSetupProgress(current).nextStep, 'gps_check');
  current.steps.push({ type: 'gps_check', status: 'failed' });
  assert.equal(telematicsStage(current), 'device_setup');
});

test('passing device checks advances to calibration without declaring release readiness', () => {
  const current = handover();
  current.steps = current.steps.map((step) => ({ ...step, status: 'passed' }));
  assert.equal(telematicsStage(current), 'calibration');
  assert.equal(deviceSetupProgress(current).passedCount, 6);
});

test('duplicate step records and unrelated calibration checks do not inflate device progress', () => {
  const current = handover({ steps: [
    { type: 'device_check', status: 'passed' },
    { type: 'device_check', status: 'passed' },
    { type: 'stationary_calibration', status: 'passed' },
  ] });
  assert.equal(deviceSetupProgress(current).passedCount, 1);
  assert.equal(deviceSetupProgress(current).nextStep, 'motion_permission');
});

test('another active rental keeps stale release-ready results locked', () => {
  const current = handover({ eligibility: { state: 'other_rental_active', canWorkSetup: false }, setup: { status: 'ready_for_release' } });
  assert.equal(telematicsStage(current), 'waiting');
  assert.equal(handoverStatusCopy(current).title, 'Another self-drive rental is active');
});

test('scheduled handover copy formats both date and time without throwing', () => {
  const copy = handoverStatusCopy(handover({ rentalStartAt: '2026-10-16T06:30:00Z', eligibility: { state: 'rental_scheduled' } }));
  assert.match(copy.description, /2:30/);
  assert.doesNotMatch(copy.description, /PHT|UTC|Asia\/Manila/);
});

const calibrationTypes = CALIBRATION_CHECK_ORDER;
function overviewHandover(overrides = {}) {
  return handover({
    calibration: { nextStep: 'stationary_calibration', context: 'demo-context' },
    steps: [...SETUP_CHECK_ORDER, ...calibrationTypes].map((type) => ({ type, status: 'pending', attemptCount: 0 })),
    ...overrides,
  });
}

test('overview opens device setup without unlocking calibration or customer release', () => {
  const current = overviewHandover();
  const overview = setupOverview(current);
  assert.equal(overview.device.status, 'available');
  assert.equal(overview.device.canOpen, true);
  assert.equal(overview.calibration.canOpen, false);
  assert.equal(overview.release, 'locked');
  assert.equal(resolveSetupView(current, 'calibration'), 'overview');
  assert.equal(resolveSetupView(current, 'rental'), 'overview');
});

test('saved device progress and failures survive reopening the overview', () => {
  const current = overviewHandover();
  current.steps[0] = { ...current.steps[0], status: 'passed', attemptCount: 1 };
  current.steps[1] = { ...current.steps[1], status: 'failed', attemptCount: 1 };
  const overview = setupOverview(current);
  assert.equal(overview.device.passedCount, 1);
  assert.equal(overview.device.status, 'failed');
  assert.equal(resolveSetupView(current, 'device_setup'), 'device_setup');
  assert.equal(overview.calibration.canOpen, false);
});

test('all six actual device results unlock calibration with current server context', () => {
  const current = overviewHandover();
  current.steps = current.steps.map((step) => ({ ...step, status: SETUP_CHECK_ORDER.includes(step.type) ? 'passed' : 'pending', attemptCount: 1 }));
  assert.equal(setupOverview(current).device.status, 'completed');
  assert.equal(resolveSetupView(current, 'calibration'), 'calibration');
  current.calibration.context = null;
  assert.equal(resolveSetupView(current, 'calibration'), 'overview');
});

test('calibration progress counts only stationary and forward, preserving unrelated history', () => {
  const current = overviewHandover();
  current.steps = current.steps.map((step) => ({ ...step, status: 'passed', attemptCount: 1 }));
  current.steps.push({ type: 'other_calibration', status: 'passed', attemptCount: 1 });
  current.steps.push({ type: 'stationary_calibration', status: 'passed', attemptCount: 1 });
  for (const type of ['braking_calibration', 'left_turn_calibration', 'right_turn_calibration']) current.steps.push({ type, status: 'failed', attemptCount: 1 });
  assert.equal(setupOverview(current).calibration.passedCount, 2);
  assert.equal(setupOverview(current).calibration.total, 2);
});

test('ready for release permits neither more captures nor opening the rental', () => {
  const current = overviewHandover({ setup: { status: 'ready_for_release' } });
  current.steps = current.steps.map((step) => ({ ...step, status: 'passed', attemptCount: 1 }));
  assert.equal(setupOverview(current).release, 'awaiting_staff');
  for (const view of ['device_setup', 'calibration', 'rental']) assert.equal(resolveSetupView(current, view), 'overview');
});

test('only server-confirmed staff release opens the rental and leaves results read-only', () => {
  const current = overviewHandover({ setup: { status: 'released' }, eligibility: { state: 'released', canWorkSetup: false } });
  assert.equal(setupOverview(current).release, 'released');
  assert.equal(resolveSetupView(current, 'rental'), 'rental');
  assert.equal(resolveSetupView(current, 'device_setup'), 'overview');
});

test('lost eligibility or a new failed prerequisite returns an open stage to overview', () => {
  const current = overviewHandover();
  current.steps = current.steps.map((step) => ({ ...step, status: 'passed', attemptCount: 1 }));
  assert.equal(resolveSetupView(current, 'calibration'), 'calibration');
  current.steps[0].status = 'failed';
  assert.equal(resolveSetupView(current, 'calibration'), 'overview');
  current.eligibility = { state: 'other_rental_active', canWorkSetup: false };
  assert.equal(resolveSetupView(current, 'device_setup'), 'overview');
});

test('test-mode release readiness does not fabricate completed device or calibration progress', () => {
  const current = overviewHandover({ setup: { status: 'ready_for_release' }, eligibility: { state: 'handover_in_progress', testMode: true, canWorkSetup: true } });
  const mount = current.steps.find((step) => step.type === 'phone_mount');
  mount.status = 'passed';
  mount.attemptCount = 1;
  const overview = setupOverview(current);
  assert.equal(overview.device.passedCount, 1);
  assert.equal(overview.calibration.passedCount, 0);
  assert.equal(overview.release, 'awaiting_staff');
  assert.equal(overview.calibration.canOpen, false);
});
