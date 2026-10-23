import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function native(platform = 'android', changes = {}) {
  let task, options, registered = false;
  let starts = 0, stops = 0;
  class LocationMonitoringIssue extends Error { constructor(message, settings) { super(message); this.needsSettings = settings; } }
  const location = {
    Accuracy: { High: 4 }, ActivityType: { AutomotiveNavigation: 1 },
    hasStartedLocationUpdatesAsync: async () => registered,
    stopLocationUpdatesAsync: async () => { registered = false; stops++; },
    startLocationUpdatesAsync: async (_task, value) => { starts++; options = value; registered = true; },
    ...changes.location,
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('./background-location-collector.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(source, { exports, Date, Number, Array, Promise, require(name) {
    if (name === 'react-native') return { Platform: { OS: platform } };
    if (name === 'expo-location') return location;
    if (name === 'expo-task-manager') return { isTaskDefined: () => false, defineTask: (_name, handler) => { task = handler; } };
    if (name === '@/constants/theme') return { themeColors: { primary: '#346EF6' } };
    if (name === './location-monitoring-session') return { LocationMonitoringIssue };
    if (name === './background-location-access') return { readRentalBackgroundAccess: async () => changes.access ?? { status: 'ready' } };
    throw new Error(`Unexpected dependency ${name}`);
  } });
  return { ...exports, get options() { return options; }, get starts() { return starts; }, get stops() { return stops; }, get registered() { return registered; },
    emit: (data, error) => task({ data, error }) };
}
const fix = (timestamp, latitude = 14) => ({ timestamp, coords: { latitude, longitude: 121, accuracy: 5, speed: 10, heading: 80 } });

for (const platform of ['android', 'ios']) {
  test(`${platform}: definition and permission check never start collection; explicit watch enables system visibility`, async () => {
    const api = native(platform);
    assert.equal(api.starts, 0);
    await api.prepareBackgroundCollection(() => true);
    assert.equal(api.starts, 0);
    const subscription = await api.watchBackgroundLocation(5, () => {}, () => {});
    assert.equal(api.starts, 1);
    assert.equal(api.options.showsBackgroundLocationIndicator, true);
    assert.equal(api.options.foregroundService.killServiceOnDestroy, true);
    assert.match(api.options.foregroundService.notificationBody, /Telematics to stop/);
    assert.equal(api.options.timeInterval, 5000);
    subscription.remove();
    await api.stopBackgroundCollection();
    assert.equal(api.registered, false);
  });
}

test('a task batch uploads only its latest sample and awaits delivery without speed or heading', async () => {
  const api = native();
  let delivered, finish;
  await api.watchBackgroundLocation(5, async value => { delivered = value; await new Promise(resolve => { finish = resolve; }); }, () => {});
  let completed = false;
  const task = api.emit({ locations: [fix(2000, 14.002), fix(1000, 14.001)] }).then(() => { completed = true; });
  await Promise.resolve();
  assert.equal(delivered.latitude, 14.002);
  assert.deepEqual(Object.keys(delivered), ['latitude', 'longitude', 'accuracy', 'captured_at']);
  assert.equal(completed, false);
  finish(); await task;
  await api.stopBackgroundCollection();
});

test('a cold task without an in-memory consented receiver stops without uploading or restoring credentials', async () => {
  const api = native('android', { location: { hasStartedLocationUpdatesAsync: async () => true } });
  await api.emit({ locations: [fix(1000)] });
  assert.equal(api.starts, 0);
  assert.equal(api.stops, 1);
});

test('late callbacks after stop cannot deliver readings and old subscriptions cannot stop a new watcher', async () => {
  const api = native();
  const readings = [];
  const first = await api.watchBackgroundLocation(5, value => readings.push(value), () => {});
  const second = await api.watchBackgroundLocation(5, value => readings.push(value), () => {});
  first.remove();
  await api.emit({ locations: [fix(2000)] });
  assert.equal(readings.length, 1);
  assert.equal(api.registered, true);
  second.remove();
  await api.stopBackgroundCollection();
  await api.emit({ locations: [fix(3000)] });
  assert.equal(readings.length, 1);
});

test('native failures are awaited and denied access never starts a watcher', async () => {
  const denied = native('ios', { access: { status: 'background_required' } });
  await assert.rejects(denied.prepareBackgroundCollection(() => true), /Allow background/);
  assert.equal(denied.starts, 0);
  const api = native();
  let errors = 0;
  await api.watchBackgroundLocation(5, () => assert.fail('Error cannot deliver a fix'), async () => { errors++; await api.stopBackgroundCollection(); });
  await api.emit(undefined, { message: 'Native error must not be logged' });
  assert.equal(errors, 1);
  assert.equal(api.registered, false);
});

test('concurrent registrations are serialized and cancellation during native start cleans up', async () => {
  let release, markStarting;
  const starting = new Promise(resolve => { markStarting = resolve; });
  let registered = false;
  const api = native('android', { location: {
    hasStartedLocationUpdatesAsync: async () => registered,
    stopLocationUpdatesAsync: async () => { registered = false; },
    startLocationUpdatesAsync: async () => { registered = true; markStarting(); await new Promise(resolve => { release = resolve; }); },
  } });
  const subscription = api.watchBackgroundLocation(5, () => assert.fail('Cancelled'), () => {});
  await starting;
  const cleanup = api.stopBackgroundCollection();
  release(); await subscription; await cleanup;
  assert.equal(registered, false);
});
