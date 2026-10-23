import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { rcSessionSetupSchema, rcTrialReviewSchema } from '../../validation/research/rc-research.ts';

function service(http, platform = 'android') {
  const exports = {};
  const source = readFileSync(new URL('./rc-research-records.service.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, FormData, Error, require(name) {
      if (name === 'expo-constants') return { default: { expoConfig: { version: '1.0.0' } } };
      if (name === 'react-native') return { Platform: { OS: platform } };
      if (name === '@/services/http') return http;
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports;
}
const setup = { name: 'Controlled trial', phone_model: 'Test phone', rc_model: 'Test RC', surface: 'Smooth concrete',
  slope: 'level', mount_orientation: 'flat', mount_method: 'Fixed mount', battery_condition: 'full',
  movement: 'acceleration', intensity: 'normal', consent: true };
const review = { observed_movement: 'acceleration', observed_intensity: 'harsh', label_status: 'confirmed', quality: 'usable',
  event_start_ms: 41000, event_end_ms: 48000, notes: 'Observer confirmed' };

test('setup consent, conditional labels and bounded text match the research contract', () => {
  assert.equal(rcSessionSetupSchema.safeParse(setup).success, true);
  for (const change of [{ consent: false }, { name: ' ' }, { phone_model: 'x'.repeat(101) }, { movement: 'stationary' }, { intensity: 'not_applicable' }])
    assert.equal(rcSessionSetupSchema.safeParse({ ...setup, ...change }).success, false);
  assert.equal(rcSessionSetupSchema.safeParse({ ...setup, movement: 'stationary', intensity: 'not_applicable' }).success, true);
});

test('review accepts manual intervals beyond ten seconds and enforces actual capture bounds', () => {
  assert.equal(rcTrialReviewSchema(50000).safeParse(review).success, true);
  for (const change of [{ event_end_ms: 50001 }, { event_start_ms: 48000 }, { event_start_ms: NaN },
    { observed_movement: 'stationary' }, { label_status: 'pending' }, { notes: 'x'.repeat(501) }])
    assert.equal(rcTrialReviewSchema(50000).safeParse({ ...review, ...change }).success, false);
});

for (const platform of ['android', 'ios']) test(`${platform}: session mapping excludes trial labels and sends platform metadata`, async () => {
  const api = service({ apiPost: async (path, body) => {
    assert.equal(path, '/mobile/rc-research/sessions');
    assert.equal(body.platform, platform); assert.equal(body.app_version, '1.0.0');
    assert.equal(body.movement, undefined); assert.equal(body.intensity, undefined); assert.equal(body.consent, true);
    return { data: { id: 'session-one' } };
  } }, platform);
  assert.equal((await api.createRcResearchSession(setup)).id, 'session-one');
});

test('review uploads raw samples separately from summaries and retries the same immutable trial key', async () => {
  let calls = 0;
  const capture = { client_trial_id: 'trial-same-key', started_at: '2026-10-18T00:00:00.000Z',
    ended_at: '2026-10-18T00:00:50.000Z', samples: [{ linear_x: 1 }], summary: { untrusted: 'must not send' } };
  const api = service({ apiPost: async (path, body) => {
    calls++;
    assert.equal(path, '/mobile/rc-research/sessions/session-one/trials');
    assert.ok(body instanceof FormData);
    assert.equal(body.get('samples_json'), JSON.stringify(capture.samples));
    assert.equal(body.get('client_trial_id'), 'trial-same-key');
    assert.equal(body.get('summary'), null);
    assert.equal(body.get('event_end_ms'), '48000');
    assert.equal(body.get('intended_intensity'), 'normal');
    if (calls === 1) throw new Error('network interrupted');
    return { data: { id: 'saved-trial' } };
  } });
  const session = { id: 'session-one', protocol: { version: 1, max_samples_json_bytes: 4000000 } };
  await assert.rejects(api.saveRcResearchTrial(session, setup, capture, review), /network interrupted/);
  assert.equal((await api.saveRcResearchTrial(session, setup, capture, review)).id, 'saved-trial');
  assert.equal(capture.samples.length, 1);
});

test('oversized transport is rejected before a request and paginated reads use the shared client', async () => {
  const api = service({ apiPost: () => assert.fail('Oversized samples must not upload'), apiGet: async path => {
    assert.equal(path, '/mobile/rc-research/trials?page=2'); return { data: [{ id: 'trial' }], meta: { current_page: 2, last_page: 3 } };
  }, apiDelete: async path => assert.equal(path, '/mobile/rc-research/trials/trial-one') });
  await assert.rejects(api.saveRcResearchTrial({ id: 'session', protocol: { max_samples_json_bytes: 1 } }, setup,
    { samples: [{ linear_x: 1 }] }, review), /too large/);
  const page = await api.listRcResearchTrials(2);
  assert.equal(page.page, 2); assert.equal(page.lastPage, 3); assert.equal(page.trials[0].id, 'trial');
  await api.deleteRcResearchTrial('trial-one');
});
