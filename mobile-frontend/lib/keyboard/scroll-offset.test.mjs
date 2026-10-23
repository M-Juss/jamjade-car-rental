import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getFocusedFieldScrollOffset } from './scroll-offset.ts';

const layout = {
  fieldTop: 200, fieldHeight: 80, viewportTop: 100, viewportHeight: 600,
  keyboardTop: 500, scrollOffset: 120, clearance: 12,
};

test('a visible field does not move', () => {
  assert.equal(getFocusedFieldScrollOffset(layout), null);
});
test('the keyboard obscures a field and its error message', () => {
  assert.equal(getFocusedFieldScrollOffset({ ...layout, fieldTop: 450 }), 162);
});
test('a fixed footer limits visibility even when above the keyboard', () => {
  assert.equal(getFocusedFieldScrollOffset({ ...layout, viewportHeight: 300, fieldTop: 350 }), 162);
});
test('Android resize does not add the keyboard height a second time', () => {
  assert.equal(getFocusedFieldScrollOffset({ ...layout, viewportHeight: 400, fieldTop: 450 }), 162);
});
test('switching to a field above the viewport scrolls upward', () => {
  assert.equal(getFocusedFieldScrollOffset({ ...layout, fieldTop: 50 }), 58);
});
test('a hardware keyboard uses the visible viewport', () => {
  assert.equal(getFocusedFieldScrollOffset({ ...layout, keyboardTop: undefined, fieldTop: 650 }), 162);
});
test('a very tall multiline field keeps its start visible', () => {
  assert.equal(getFocusedFieldScrollOffset({ ...layout, fieldTop: 200, fieldHeight: 500 }), 208);
});
test('scrolling never requests a negative offset or an unusable viewport', () => {
  assert.equal(getFocusedFieldScrollOffset({ ...layout, fieldTop: 50, scrollOffset: 0 }), 0);
  assert.equal(getFocusedFieldScrollOffset({ ...layout, keyboardTop: 100 }), null);
});
