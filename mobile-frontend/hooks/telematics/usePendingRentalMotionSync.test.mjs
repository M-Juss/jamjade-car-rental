import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function harness({ online = true, status = { active: false, state: 'stopped', unfinished: [{ id: 's1', booking_code: 'BK-1' }] } } = {}) {
  let cleanup, interval, listener, currentStatus = status, connected = online;
  const recovered = [];
  const appState = { currentState: 'active', addEventListener: (_, cb) => { listener = cb; return { remove() {} }; } };
  const dependencies = {
    react: { useEffect: fn => { cleanup = fn(); } },
    'react-native': { AppState: appState },
    '@/services/telematics/network-readiness': { getNetworkReadiness: async () => connected },
    '@/services/telematics/rental-drive-monitoring': {
      rentalMotionStatus: async () => currentStatus,
      recoverRentalDriveMonitoring: async (owner, booking, id, allowed) => { if (allowed()) recovered.push([owner, booking, id]); },
    },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./usePendingRentalMotionSync.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, require: name => dependencies[name], setInterval: fn => { interval = fn; return 1; }, clearInterval() {} });
  return { start: id => exports.usePendingRentalMotionSync(id), recovered, tick: () => interval?.(), cleanup: () => cleanup?.(), setOnline: v => { connected = v; }, setStatus: v => { currentStatus = v; }, background: () => { appState.currentState = 'background'; listener('background'); }, foreground: () => { appState.currentState = 'active'; listener('active'); } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test('recovers a stopped queued session without starting capture', async () => {
  const h = harness(); h.start(7); await settle(); assert.deepEqual(h.recovered, [[7, 'BK-1', 's1']]); h.cleanup();
});
test('retries after connection returns and only while foreground', async () => {
  const h = harness({ online: false }); h.start(7); await settle(); h.background(); h.setOnline(true); h.tick(); await settle(); assert.equal(h.recovered.length, 0);
  h.foreground(); await settle(); assert.equal(h.recovered.length, 1); h.cleanup();
});
test('does not interrupt active upload, active capture or blocked transfer', async () => {
  for (const status of [{ active: true, state: 'stopped', unfinished: [{ id: 's', booking_code: 'b' }] }, { active: false, state: 'retrying', unfinished: [{ id: 's', booking_code: 'b' }] }, { active: false, state: 'review_required', unfinished: [{ id: 's', booking_code: 'b' }] }]) {
    const h = harness({ status }); h.start(7); await settle(); assert.equal(h.recovered.length, 0); h.cleanup();
  }
});
test('does nothing when signed out or after cleanup', async () => {
  const h = harness(); h.start(null); await settle(); assert.equal(h.recovered.length, 0);
  const h2 = harness(); h2.start(7); h2.cleanup(); await settle(); assert.equal(h2.recovered.length, 0);
});
