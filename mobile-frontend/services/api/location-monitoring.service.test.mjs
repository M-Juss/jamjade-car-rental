import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const load = (file, imports = {}) => {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, Date, require: (name) => imports[name] ?? require(name) });
  return exports;
};
const schemas = load('../../validation/telematics/location-monitoring.ts');
const policy = { consentVersion: 3, uploadIntervalSeconds: 5, maximumAccuracyMeters: 50, maximumAgeSeconds: 60, futureSkewSeconds: 10, retentionHours: 24 };
const fix = { latitude: 14, longitude: 121, accuracy: 5, captured_at: '2026-10-18T04:00:00Z' };

test('requests use the domain API service, booking code and only the validated latest-location fields', async () => {
  const calls = [];
  const http = { apiGet: async (...args) => { calls.push(args); return { data: {} }; }, apiPost: async (...args) => { calls.push(args); return { data: {} }; } };
  const service = load('./location-monitoring.service.ts', { '@/services/http': http, '@/validation/telematics/location-monitoring': schemas });
  const controller = new AbortController();
  await service.getLocationMonitoring('DEMO/booking', controller.signal);
  await service.startLocationMonitoring('DEMO/booking', { ...fix, speed: 99 }, { consent: true, consent_version: 3, sharing_mode: 'foreground' }, policy, controller.signal);
  await service.updateLatestLocation('DEMO/booking', fix, 'a'.repeat(64), policy, controller.signal);
  await service.pauseLocationMonitoring('DEMO/booking', 'a'.repeat(64), controller.signal);
  assert.equal(calls[0][0], '/mobile/bookings/DEMO%2Fbooking/location-monitoring');
  assert.equal(calls[1][0], '/mobile/bookings/DEMO%2Fbooking/location-monitoring/start');
  assert.equal(calls[1][1].speed, undefined);
  assert.equal(calls[1][1].session_token, undefined);
  assert.equal(calls[2][1].session_token, 'a'.repeat(64));
  assert.deepEqual(Object.keys(calls[3][1]), ['session_token']);
  assert.equal(calls[1][2].signal, controller.signal);
});

test('client schemas mirror coordinate, accuracy, consent version and token bounds', () => {
  const start = schemas.startLocationMonitoringSchema(policy);
  for (const consent of [true, 1, '1']) assert.equal(start.safeParse({ ...fix, consent, consent_version: 3, sharing_mode: 'foreground' }).success, true);
  for (const invalid of [
    { latitude: 91 }, { longitude: -181 }, { accuracy: 51 }, { accuracy: null }, { accuracy: -1 },
    { consent: false }, { consent: 'yes' }, { consent_version: 1 }, { consent_version: 2 }, { sharing_mode: 'unknown' }, { captured_at: 'invalid' },
  ]) assert.equal(start.safeParse({ ...fix, consent: true, consent_version: 3, sharing_mode: 'foreground', ...invalid }).success, false);
  assert.equal(schemas.updateLatestLocationSchema(policy).safeParse({ ...fix, session_token: 'short' }).success, false);
});
