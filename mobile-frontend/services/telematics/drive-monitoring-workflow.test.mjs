import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function harness({ lostResponse = false, failedTransfer = false, pending = 0 } = {}) {
  const calls = [];
  const reference = { rotation_rfu: [[1,0,0],[0,1,0],[0,0,1]], acceleration_mean: [0,0,9.81], gyroscope_mean: [0,0,0] };
  class NativeRecorderError extends Error {}
  class ApiError extends Error {}
  const dependencies = {
    '@/modules/rc-recorder': { default: {
      driveStartIdentity: async () => { calls.push('identity'); return 'client-id'; },
      clearDriveStartIdentity: async () => { calls.push('clear'); }, startDriveMonitoring: async () => {},
    } },
    './native-recorder': { NativeRecorderError, nativeRecorder: {
      authorize: async () => { calls.push('authorize'); },
      start: async () => { calls.push('capture'); }, status: async () => ({ active: true, preparing: false }),
      stop: async () => { calls.push('stop-capture'); },
    } },
    './drive-monitoring-transfer': {
      getDriveMonitoringTransferStatus: async () => ({ unfinished_sessions: [], finishing: false, pending_batches: pending }),
      connectDriveMonitoringTransfer: async () => { calls.push('transfer'); if (failedTransfer) throw new Error('offline'); },
    },
    '@/services/api/drive-monitoring.service': {
      getDriveMonitoringReference: async () => { calls.push('reference'); return { reference_run_id: 'ref-id' }; },
      openDriveMonitoringSession: async input => {
        calls.push('open'); assert.equal(input.client_session_id, 'client-id');
        if (lostResponse) throw new Error('response lost');
        return { id: 'server-id', status: 'active', runtime_reference: reference };
      },
      stopDriveMonitoringSession: async () => { calls.push('stop-server'); },
    }, '@/services/http': { ApiError },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./drive-monitoring-workflow.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, setTimeout, require: name => { if (!(name in dependencies)) throw new Error(name); return dependencies[name]; } });
  return { calls, start: () => exports.startDriveMonitoring(7, {}, 'research-id', 'mount-id') };
}

test('starts only after access, matching reference, durable identity and server consent', async () => {
  const h = harness(); await h.start();
  assert.deepEqual(h.calls, ['authorize','reference','identity','open','capture','transfer']);
});
test('lost start response retains identity and never starts sensors', async () => {
  const h = harness({ lostResponse: true }); await assert.rejects(h.start(), /response lost/);
  assert.deepEqual(h.calls, ['authorize','reference','identity','open']);
});
test('a connection failure with queued windows never closes the server prematurely', async () => {
  const h = harness({ failedTransfer: true, pending: 1 }); await assert.rejects(h.start(), /offline/);
  assert.ok(h.calls.includes('stop-capture')); assert.ok(!h.calls.includes('stop-server')); assert.ok(!h.calls.includes('clear'));
});
test('a failed empty capture closes the server reservation and clears its retry identity', async () => {
  const h = harness({ failedTransfer: true }); await assert.rejects(h.start(), /offline/);
  assert.deepEqual(h.calls.slice(-3), ['stop-capture','stop-server','clear']);
});
