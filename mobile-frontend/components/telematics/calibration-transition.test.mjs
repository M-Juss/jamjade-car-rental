import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { CALIBRATION_STEPS, isCalibrationStep } from '../../lib/telematics/calibration.ts';

function loadComponent(file, dependencies, globals = {}) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const element = (type, props) => ({ type, props });
  vm.runInNewContext(compiled, { exports, ...globals, require(name) {
    if (name === 'react/jsx-runtime') return { jsx: element, jsxs: element };
    if (name.endsWith('/calibration')) return { CALIBRATION_STEPS, isCalibrationStep };
    if (dependencies[name]) return dependencies[name];
    return new Proxy({}, { get: (_, property) => property });
  } });
  return exports;
}

test('all five server-confirmed exercises render success before any next recording form', () => {
  const success = () => {};
  const { TelematicsCalibration } = loadComponent('./TelematicsCalibration.tsx', {
    react: { useState: () => [false, () => {}] },
    '@/components/telematics/CalibrationSuccess': { CalibrationSuccess: success },
  });
  for (const profileId of ['standard', 'rc_demo']) for (const [index, step] of Object.keys(CALIBRATION_STEPS).entries()) {
    let started = false, advanced = false;
    const nextStep = Object.keys(CALIBRATION_STEPS)[index + 1] ?? null;
    const tree = TelematicsCalibration({
      handover: { calibration: { profile: { id: profileId }, nextStep }, steps: [] },
      consent: { consent: true, supervised: true }, busy: false, recording: false,
      live: { step, phase: 'passed' }, onStart: () => { started = true; }, onDismissSuccess: () => { advanced = true; },
    });
    assert.equal(tree.type, success);
    assert.equal(tree.props.step, step);
    assert.equal(tree.props.nextStep, nextStep);
    assert.equal(started, false);
    assert.equal(advanced, false);
    tree.props.onComplete();
    assert.equal(advanced, true);
  }
});

test('the success display holds its result and cancels advancement on unmount, including reduced motion', () => {
  for (const reducedMotion of [false, true]) {
    let effect, nextId = 0, advanced = 0;
    const timers = new Map();
    const { CalibrationSuccess } = loadComponent('./CalibrationSuccess.tsx', {
      react: { useRef: (value) => ({ current: value }), useEffect: (value) => { effect = value; } },
      'react-native': { Animated: { Value: class { setValue() {} interpolate() { return 1; } }, timing: () => ({ start() {}, stop() {} }), View: 'View' } },
      '@/hooks/telematics/useCalibrationVisuals': { useCalibrationVisuals: () => ({ reducedMotion }) },
      '@/constants/theme': { themeColors: { success: 'success' } },
    }, {
      setTimeout: (callback, delay) => { timers.set(++nextId, { callback, delay }); return nextId; },
      clearTimeout: (id) => timers.delete(id),
    });
    const props = { step: 'right_turn_calibration', nextStep: null, ready: true, onComplete: () => { advanced++; } };
    CalibrationSuccess({ ...props, ready: false });
    effect();
    assert.equal(timers.size, 0);
    CalibrationSuccess(props);
    const cleanup = effect();
    assert.equal(advanced, 0);
    const pending = [...timers.values()][0];
    assert.ok(pending.delay >= 2000);
    cleanup();
    assert.equal(timers.size, 0);
    CalibrationSuccess(props);
    effect();
    [...timers.values()][0].callback();
    assert.equal(advanced, 1);
  }
});
