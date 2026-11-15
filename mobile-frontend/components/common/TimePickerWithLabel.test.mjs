import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { toBookingTimestamp } from '../../lib/browse/booking-time.ts';

function picker({ date = '2026-11-15', clock = '2026-11-15T04:00:00Z', value = '12:05' } = {}) {
  let timestamp = Date.parse(clock);
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [timestamp])); }
    static now() { return timestamp; }
  }
  const changes = [];
  const compile = (file, require) => {
    const exports = {};
    const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    vm.runInNewContext(source, { exports, require, Date: Clock, Intl });
    return exports;
  };
  const time = compile('../../lib/browse/pickup-time.ts', () => ({ toBookingTimestamp }));
  const jsx = (type, props) => typeof type === 'function' ? type(props) : { type, props };
  let stateIndex = 0;
  const component = compile('./TimePickerWithLabel.tsx', (name) => {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react') return {
      useMemo: (factory) => factory(), useEffect: () => {},
      useState: (initial) => [stateIndex++ === 0 ? true : typeof initial === 'function' ? initial() : initial, () => {}],
    };
    if (name === 'react-native') return Object.fromEntries(['Modal', 'Pressable', 'ScrollView', 'Text', 'View'].map((key) => [key, key]));
    if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ bottom: 0 }) };
    if (name === '@/constants/theme') return { themeColors: {} };
    if (name === '@expo/vector-icons/MaterialIcons') return { default: 'Icon' };
    if (name === '@/lib/browse/pickup-time') return time;
    throw new Error(`Unexpected picker import: ${name}`);
  });
  const tree = component.TimePickerWithLabel({ label: 'Pickup time', value, pickupDate: date, onChange: (next) => changes.push(next) });
  const buttons = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'Pressable') buttons.push(node);
    for (const child of [node.props?.children].flat(Infinity)) visit(child);
  }
  visit(tree);
  const text = (node) => typeof node === 'string' ? node : [node?.props?.children].flat(Infinity).filter(Boolean).map(text).join('');
  return { changes, buttons, option: (label) => buttons.find((button) => text(button) === label), advance: (next) => { timestamp = Date.parse(next); } };
}

test('today disables elapsed hours, minutes and AM while allowing a future pickup', () => {
  const h = picker();
  assert.equal(h.option('AM').props.disabled, true);
  assert.equal(h.option('PM').props.disabled, false);
  assert.equal(h.option('00').props.disabled, true);
  assert.equal(h.option('05').props.disabled, false);
  assert.equal(h.option('Apply Time').props.disabled, false);
  h.option('Apply Time').props.onPress();
  assert.deepEqual(h.changes, ['12:05']);
});

test('future dates retain earlier clock options', () => {
  const h = picker({ date: '2026-11-16', value: '09:00' });
  assert.equal(h.option('AM').props.disabled, false);
  assert.equal(h.option('9').props.disabled, false);
  h.option('Apply Time').props.onPress();
  assert.deepEqual(h.changes, ['09:00']);
});

test('no pickup can be applied after the final five-minute slot or on a past date', () => {
  for (const options of [{ clock: '2026-11-15T15:56:00Z', value: '23:55' }, { date: '2026-11-14' }]) {
    const h = picker(options);
    assert.equal(h.option('Apply Time').props.disabled, true);
    h.option('Apply Time').props.onPress();
    assert.deepEqual(h.changes, []);
  }
});

test('Apply rechecks the clock when the chosen time passes while the picker is open', () => {
  const h = picker();
  h.advance('2026-11-15T04:06:00Z');
  h.option('Apply Time').props.onPress();
  assert.deepEqual(h.changes, []);
});
