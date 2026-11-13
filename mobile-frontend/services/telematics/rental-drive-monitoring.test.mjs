import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function harness({ denied = false, lostResponse = false, failedCapture = false, pending = 0, cancelAfterOpen = false, cancelDuringTransfer = false, closed = false, checkFails = false } = {}) {
  const calls = [];
  let current = true;
  const reference = { rotation_rfu: [[1,0,0],[0,1,0],[0,0,1]], acceleration_mean: [0,0,9.81], gyroscope_mean: [0,0,0] };
  const dependencies = {
    './native-recorder': { ensureMotionNotificationPermission: async () => { calls.push('permission'); if (denied) throw new Error('denied'); } },
    '@/modules/rc-recorder': { default: {
      rentalMonitoringPrepare: async (owner, booking) => { calls.push('identity'); assert.equal(owner, '7'); assert.equal(booking, 'BK-TEST'); return 'stable-id'; },
      rentalMonitoringStart: async config => {
        calls.push('capture'); const input = JSON.parse(config);
        assert.equal(input.api_url, 'https://backend.example.test/api/mobile/bookings/BK-TEST/motion-monitoring/sessions/server-id/batches');
        assert.equal(input.token, 'synthetic-token'); assert.deepEqual(input.reference, reference);
        if (failedCapture) throw new Error('capture failed');
      },
      rentalMonitoringStatus: async () => JSON.stringify({ active: !failedCapture, booking_code: 'BK-TEST', pending_batches: pending }),
      rentalMonitoringStop: async () => { calls.push('stop-capture'); },
      rentalMonitoringDiscardStart: async () => { calls.push('clear-identity'); },
      rentalMonitoringRecover: async () => { calls.push('recover'); },
      rentalMonitoringDiscardCompleted: async (owner, booking, id) => { calls.push(`discard:${owner}:${booking}:${id}`); },
    } },
    '@/services/api/rental-motion.service': {
      getRentalMotion: async () => { if (checkFails) throw new Error('offline'); return { report_sync_closed: closed }; },
      startRentalMotion: async (booking, input) => {
        calls.push('open'); assert.equal(booking, 'BK-TEST'); assert.equal(input.client_session_id, 'stable-id');
        assert.equal(input.consent_version, 'rental-rc-motion-v1'); assert.equal(input.same_mount_confirmed, true);
        if (lostResponse) throw new Error('response lost');
        if (cancelAfterOpen) current = false;
        return { id: 'server-id', status: 'active', runtime_reference: reference };
      },
      stopRentalMotion: async () => { calls.push('stop-server'); },
    },
    '@/services/http/auth-token': { getApiAuthToken: async () => {
      if (cancelDuringTransfer) current = false;
      return 'synthetic-token';
    } },
    '@/services/http/config': { API_BASE_URL: 'https://backend.example.test/api' },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./rental-drive-monitoring.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, URL, setTimeout, require: name => { if (!(name in dependencies)) throw new Error(name); return dependencies[name]; } });
  return { calls, api: exports, start: () => exports.beginRentalDriveMonitoring(7, 'BK-TEST', () => current) };
}

test('rental capture uses explicit motion consent, a stable identity and the rental-scoped HTTPS path', async () => {
  const h = harness(); await h.start();
  assert.deepEqual(h.calls, ['permission', 'identity', 'open', 'capture']);
});
test('notification denial never opens a rental motion session', async () => {
  const h = harness({ denied: true }); await assert.rejects(h.start(), /denied/);
  assert.deepEqual(h.calls, ['permission']);
});
test('a lost server response retains the stable identity without starting sensors', async () => {
  const h = harness({ lostResponse: true }); await assert.rejects(h.start(), /response lost/);
  assert.deepEqual(h.calls, ['permission', 'identity', 'open']);
});
test('failed empty startup stops the reservation and clears its retry identity', async () => {
  const h = harness({ failedCapture: true }); await assert.rejects(h.start(), /capture failed/);
  assert.deepEqual(h.calls.slice(-3), ['stop-capture', 'stop-server', 'clear-identity']);
});
test('failed startup with buffered windows retains the server session for recovery', async () => {
  const h = harness({ failedCapture: true, pending: 2 }); await assert.rejects(h.start(), /capture failed/);
  assert.ok(h.calls.includes('stop-capture')); assert.ok(!h.calls.includes('stop-server')); assert.ok(!h.calls.includes('clear-identity'));
});
test('finishing an existing transfer never restarts sensors', async () => {
  const h = harness(); await h.api.recoverRentalDriveMonitoring(7, 'BK-TEST', 'server-id');
  assert.deepEqual(h.calls, ['recover']);
});
test('cancelled recovery does not start an upload after credentials load', async () => {
  const h = harness({ cancelDuringTransfer: true });
  await h.api.recoverRentalDriveMonitoring(7, 'BK-TEST', 'server-id', () => false);
  assert.deepEqual(h.calls, []);
});

test('leaving Telematics during server startup never starts a delayed hidden capture', async () => {
  const h = harness({ cancelAfterOpen: true }); await assert.rejects(h.start(), /cancelled/);
  assert.ok(!h.calls.includes('capture'));
  assert.deepEqual(h.calls.slice(-3), ['stop-capture', 'stop-server', 'clear-identity']);
});

test('pausing while the transfer credentials load cancels native startup', async () => {
  const h = harness({ cancelDuringTransfer: true });
  await assert.rejects(h.start(), /cancelled/);
  assert.ok(!h.calls.includes('capture'));
  assert.deepEqual(h.calls.slice(-3), ['stop-capture', 'stop-server', 'clear-identity']);
});

test('discards only when the server confirms completion', async () => {
  const closed = harness({ closed: true });
  assert.equal(await closed.api.discardCompletedRentalMotion(7, 'BK-TEST', 's1'), true);
  assert.deepEqual(closed.calls, ['discard:7:BK-TEST:s1']);
  const open = harness();
  assert.equal(await open.api.discardCompletedRentalMotion(7, 'BK-TEST', 's1'), false);
  assert.deepEqual(open.calls, []);
  const failed = harness({ checkFails: true });
  await assert.rejects(failed.api.discardCompletedRentalMotion(7, 'BK-TEST', 's1'), /offline/);
  assert.deepEqual(failed.calls, []);
});
