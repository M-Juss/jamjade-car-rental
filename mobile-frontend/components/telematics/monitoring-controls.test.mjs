import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function controls({ gpsActive = false, motionActive = false, motionStarting = false, ended = false, offerMotion = true } = {}) {
  let resumeCheck;
  const starts = [];
  const alerts = [];
  let pauses = 0;
  const consent = { consent: true, consent_version: 3, sharing_mode: 'foreground' };
  const snapshot = { bookingCode: 'BK-1', canMonitor: true, tripStatus: 'started', policy: { consentVersion: 3 } };
  const monitoring = {
    active: gpsActive, motionActive, motionStarting, snapshot, loading: false,
    sharing: { phase: gpsActive ? 'waiting' : 'error' },
    refresh: async () => snapshot,
    getRememberedConsent: async () => consent,
    start: (...args) => starts.push(args),
    stop: () => { pauses++; },
  };
  const element = (type, props) => ({ type, props });
  const dependencies = {
    'react/jsx-runtime': { jsx: element, jsxs: element },
    react: {
      useCallback: callback => callback, useEffect() {},
      useRef: current => ({ current }), useState: value => [value, () => {}],
    },
    'react-native': {
      AppState: { currentState: 'active' },
      Alert: { alert: (title, message, buttons) => alerts.push({ title, message, buttons }) },
      View: 'View',
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0 }) },
    '@/components/navigation/FloatingTabBarSurface': { FloatingTabBarSurface: 'Actions' },
    '@/constants/layout': { mobileLayout: { floatingGap: 8, screenPadding: 16 } },
    './LocationSharingDisclosureDialog': { LocationSharingDisclosureDialog: 'Consent' },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./TelematicsMonitoringControls.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => { assert(name in dependencies, name); return dependencies[name]; } });
  const tree = exports.TelematicsMonitoringControls({
    monitoring, released: true, ended, offerMotion, blocked: false, unread: 0,
    onActivity() {}, onResumeCheck: callback => { resumeCheck = callback; },
  });
  const items = tree.props.children[0].props.children.props.items;
  return {
    start: items.find(item => item.key === 'monitoring'),
    pause: items.find(item => item.key === 'pause'),
    starts, alerts, resume: () => resumeCheck?.(),
    get requiresCheck() { return Boolean(resumeCheck); },
    get pauses() { return pauses; },
  };
}

test('Resume can retry a missing stream while Pause remains available for the running stream', () => {
  for (const streams of [{ gpsActive: true }, { motionActive: true }, { motionStarting: true }]) {
    const h = controls(streams);
    assert.equal(h.pause.disabled, false);
    assert.equal(h.start.disabled, streams.motionStarting === true);
    h.pause.onPress();
    h.alerts.at(-1).buttons.find(button => button.text === 'Pause').onPress();
    assert.equal(h.pauses, 1);
  }
  assert.equal(controls({ gpsActive: true, motionActive: true }).start.disabled, true);
  assert.equal(controls({ gpsActive: true, offerMotion: false }).start.disabled, true);
  assert.equal(controls({ ended: true }).start.disabled, true);
});

test('GPS recovery with active motion skips the sensor check and keeps the shared Start confirmation', async () => {
  const h = controls({ motionActive: true });
  h.start.onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.requiresCheck, false);
  assert.equal(h.starts.length, 0);
  h.alerts.at(-1).buttons.find(button => button.text === 'Start').onPress();
  assert.equal(h.starts.length, 1);
  assert.equal(h.starts[0][0], 'BK-1');
  assert.equal(h.starts[0][2], true);
});

test('resuming stopped motion retains the existing stationary check and explicit confirmation', async () => {
  const h = controls({ gpsActive: true });
  h.start.onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.requiresCheck, true);
  assert.equal(h.starts.length, 0);
  h.resume();
  h.alerts.at(-1).buttons.find(button => button.text === 'Start').onPress();
  assert.equal(h.starts.length, 1);
  assert.equal(h.starts[0][2], true);
});
