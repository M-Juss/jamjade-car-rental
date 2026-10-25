import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';

function load(filename, dependencies, globals = {}) {
  const exports = {};
  const source = readFileSync(new URL(filename, import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, ...globals, require(name) {
      if (name in dependencies) return dependencies[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return exports;
}
const setup = load('../../lib/research/native-recorder.ts', {});
const validation = load('../../validation/research/native-recorder.ts', { zod: { z }, '@/lib/research/native-recorder': setup });
const values = { recording_group_id: 'd87e0341-9f66-4a01-9f92-b2d1729486e1', surface: 'Test surface', mount_method: setup.NATIVE_MOUNT_METHOD,
  slope: 'level', recording_kind: 'maneuver_trial', consent: true };
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function harness({ sdk = 33, permission = 'granted', present = true, response, request } = {}) {
  let now = 0;
  const calls = [];
  const appState = { currentState: 'active' };
  const module = Object.fromEntries(['authorize', 'lock', 'start', 'stop', 'status', 'list', 'details', 'delete', 'groups', 'createGroup'].map(name => [name, async (...args) => { calls.push([name, ...args]); return null; }]));
  module.groups = async () => { calls.push(['groups']); return JSON.stringify({ groups: [] }); };
  const api = load('./native-recorder.ts', {
    '@/modules/rc-recorder': { default: present ? module : null }, '@/validation/research/native-recorder': validation,
    '@/lib/research/native-recorder': setup,
    'react-native': { AppState: appState, Platform: { Version: sdk }, PermissionsAndroid: {
      PERMISSIONS: { POST_NOTIFICATIONS: 'notification' }, RESULTS: { GRANTED: 'granted' },
      request: async () => { calls.push(['permission']); return request ? request() : permission; },
    } },
    '@/services/http': { apiGet: async path => {
      calls.push(['get', path]);
      if (response) return response();
      now = 1100;
      return { data: { owner_id: '7', valid_for_seconds: 60, capture_protocol_version: 2, upload_available: false } };
    } },
  }, { performance: { now: () => now } }).nativeRecorder;
  return { api, calls, appState, module };
}

test('native capture uses the restricted access read, conservative lifetime, and local config only', async () => {
  const h = harness();
  await h.api.start(7, values);
  assert.deepEqual(h.calls.map(call => call[0]), ['get', 'authorize', 'permission', 'start']);
  assert.equal(h.calls[0][1], '/mobile/rc-research/native-access');
  assert.equal(h.calls[1][1], '7');
  assert.equal(h.calls[1][2], 58);
  assert.deepEqual(JSON.parse(h.calls[3][1]), values);
  assert.equal(h.api.isAuthorized(7), true);
});

for (const data of [
  { owner_id: '8', valid_for_seconds: 60, capture_protocol_version: 2 },
  { owner_id: '7', valid_for_seconds: 0, capture_protocol_version: 2 },
  { owner_id: '7', valid_for_seconds: Number.NaN, capture_protocol_version: 2 },
  { owner_id: '7', valid_for_seconds: 28801, capture_protocol_version: 2 },
  { owner_id: '7', valid_for_seconds: 60, capture_protocol_version: 1 },
]) test(`unusable authority never reaches native capture: ${JSON.stringify(data)}`, async () => {
  const h = harness({ response: async () => ({ data }) });
  await assert.rejects(h.api.start(7, values), /access could not be verified/);
  assert.equal(h.calls.some(call => call[0] === 'authorize' || call[0] === 'start'), false);
});

test('denied notifications, invalid consent, and background starts never start sensors', async () => {
  const denied = harness({ permission: 'denied' });
  await assert.rejects(denied.api.start(7, values), /Allow recording notifications/);
  assert.equal(denied.calls.some(call => call[0] === 'start'), false);
  const invalid = harness();
  await assert.rejects(invalid.api.start(7, { ...values, consent: false }));
  assert.equal(invalid.calls.length, 0);
  invalid.appState.currentState = 'background';
  await assert.rejects(invalid.api.start(7, values), /Open RC Research/);
  assert.equal(invalid.calls.length, 0);
});

test('Android 11 does not request the Android 13 notification runtime permission', async () => {
  const h = harness({ sdk: 30 });
  await h.api.start(7, values);
  assert.equal(h.calls.some(call => call[0] === 'permission'), false);
  assert.equal(h.calls.at(-1)[0], 'start');
});

test('sign-out invalidates an access response still in flight', async () => {
  const response = deferred();
  const h = harness({ response: () => response.promise });
  const connecting = h.api.authorize(7);
  const rejected = assert.rejects(connecting, /access changed/);
  await h.api.lock();
  response.resolve({ data: { owner_id: '7', valid_for_seconds: 60, capture_protocol_version: 2 } });
  await rejected;
  assert.equal(h.api.isAuthorized(7), false);
  assert.deepEqual(h.calls.map(call => call[0]), ['get', 'lock']);
});

test('sign-out while the permission prompt is open prevents a late Start', async () => {
  const prompt = deferred();
  const h = harness({ request: () => prompt.promise });
  const starting = h.api.start(7, values);
  const rejected = assert.rejects(starting, /access changed/);
  while (!h.calls.some(call => call[0] === 'permission')) await Promise.resolve();
  await h.api.lock();
  prompt.resolve('granted');
  await rejected;
  assert.equal(h.api.isAuthorized(7), false);
  assert.equal(h.calls.some(call => call[0] === 'start'), false);
});

test('a missing native module has an explicit build requirement and no v1 fallback', async () => {
  const h = harness({ present: false });
  assert.equal(h.api.available, false);
  await assert.rejects(h.api.start(7, values), /Install the updated Android/);
  await h.api.lock();
  assert.equal(h.calls.length, 0);
});

test('locked hardware fields, estimated angles and RC battery guesses cannot enter a new capture config', () => {
  for (const [field, value] of Object.entries({ rc_model: 'Another RC', mount_orientation: 'upright', mount_angle_degrees: 10, battery_condition: 'full' })) {
    assert.equal(validation.nativeRecordingSchema.safeParse({ ...values, [field]: value }).success, false);
  }
  assert.equal(validation.nativeRecordingSchema.safeParse({ ...values, recording_group_id: 'Indoor test' }).success, false);
});

test('creating a group uses validated conditions and never starts motion collection', async () => {
  const h = harness();
  const input = { surface: 'Tiles', slope: 'level', mount_method: setup.NATIVE_MOUNT_METHOD, recording_kind: 'stationary_reference' };
  await assert.rejects(h.api.createGroup(input), /Verify research access/);
  await h.api.authorize(7);
  h.module.createGroup = async json => { h.calls.push(['createGroup', json]); return JSON.stringify({ id: values.recording_group_id }); };
  const group = await h.api.createGroup(input);
  assert.equal(group.id, values.recording_group_id);
  assert.equal(JSON.parse(h.calls.at(-1)[1]).name, 'Tiles - Level - Group 01');
  assert.equal(JSON.parse(h.calls.at(-1)[1]).mount_method, setup.NATIVE_MOUNT_METHOD);
  assert.equal(h.calls.some(call => call[0] === 'start'), false);
});

test('new captures and groups require the confirmed screw-lock holder', async () => {
  const h = harness();
  await assert.rejects(h.api.start(7, { ...values, mount_method: 'Another mount' }));
  await assert.rejects(h.api.createGroup({ surface: 'Tiles', slope: 'level', recording_kind: 'maneuver_trial', mount_method: 'Another mount' }));
  assert.equal(h.calls.length, 0);
});

test('automatic group names skip existing names without modifying saved groups', () => {
  const groups = Object.freeze([
    Object.freeze({ name: 'tiles - level - group 01' }), Object.freeze({ name: 'Tiles - Level - Group 03' }),
    Object.freeze({ name: 'Tiles - Uphill - Group 01' }),
  ]);
  assert.equal(setup.nativeCollectionGroupName({ surface: ' Tiles ', slope: 'level' }, groups), 'Tiles - Level - Group 02');
  assert.equal(setup.nativeCollectionGroupName({ surface: 'Tiles', slope: 'downhill' }, groups), 'Tiles - Downhill - Group 01');
  assert.equal(setup.nativeCollectionGroupName({ surface: '', slope: 'level' }, groups), '');
});

test('generated names fit the native contract even for maximum-length surface values', () => {
  const input = { surface: 'x'.repeat(100), slope: 'uphill', mount_method: setup.NATIVE_MOUNT_METHOD, recording_kind: 'maneuver_trial' };
  const name = setup.nativeCollectionGroupName(input, []);
  assert.equal(name.length, 100);
  assert.equal(validation.nativeCollectionGroupSchema.safeParse({ ...input, name }).success, true);
  assert.equal(validation.nativeCollectionGroupFormSchema.safeParse({ ...input, name: 'Typed name' }).success, false);
});

test('queued group creation uses fresh saved names to avoid duplicate generated names', async () => {
  const h = harness();
  const groups = [];
  const input = { surface: 'Tiles', slope: 'level', mount_method: setup.NATIVE_MOUNT_METHOD, recording_kind: 'maneuver_trial' };
  await h.api.authorize(7);
  h.module.groups = async () => JSON.stringify({ groups });
  h.module.createGroup = async json => {
    const group = { ...JSON.parse(json), id: String(groups.length + 1) };
    groups.push(group); return JSON.stringify(group);
  };
  const created = await Promise.all([h.api.createGroup(input), h.api.createGroup(input)]);
  assert.deepEqual(created.map(group => group.name), ['Tiles - Level - Group 01', 'Tiles - Level - Group 02']);
});

test('sign-out during the fresh group read prevents creation with stale access', async () => {
  const h = harness();
  await h.api.authorize(7);
  const catalog = deferred();
  h.module.groups = async () => { h.calls.push(['groups']); return catalog.promise; };
  const creating = h.api.createGroup({ surface: 'Tiles', slope: 'level', mount_method: setup.NATIVE_MOUNT_METHOD, recording_kind: 'maneuver_trial' });
  const rejected = assert.rejects(creating, /access changed/);
  while (!h.calls.some(call => call[0] === 'groups')) await Promise.resolve();
  const locking = h.api.lock();
  catalog.resolve(JSON.stringify({ groups: [] }));
  await rejected;
  await locking;
  assert.equal(h.calls.some(call => call[0] === 'createGroup'), false);
});

test('an older native module cannot claim support for saved setup groups', async () => {
  const h = harness();
  delete h.module.groups;
  await assert.rejects(h.api.start(7, values), /updated Android development build/);
  assert.equal(h.calls.length, 0);
});
