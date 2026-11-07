import assert from 'node:assert/strict';
import test from 'node:test';
import plugin from './withBackendDnsFallback.js';

test('only configured HTTPS hostnames enter the exact native allowlist', () => {
  assert.deepEqual(plugin.backendHosts([
    'https://api.example.com/api', 'https://API.EXAMPLE.COM/other',
    'https://backup.example.com/api', 'http://cleartext.example.com/api',
    'https://user:password@credentials.example.com/api', 'https://127.0.0.1/api',
    'https://[::1]/api', 'https://localhost/api', 'https://device.local/api',
    'https://device.localhost/api', 'https://dns.google/resolve', 'invalid', undefined,
  ]), ['api.example.com', 'backup.example.com']);
});

test('manifest configuration is idempotent, preserves other metadata and contains no URL paths', () => {
  const manifest = { application: [{ 'meta-data': [{ $: { 'android:name': 'existing', 'android:value': 'keep' } }] }] };
  plugin.configureManifest(manifest, ['https://api.example.com/api/private-path']);
  plugin.configureManifest(manifest, ['https://api.example.com/api/private-path']);
  assert.deepEqual(manifest.application[0]['meta-data'], [
    { $: { 'android:name': 'existing', 'android:value': 'keep' } },
    { $: { 'android:name': 'com.jamjade.network.BACKEND_DNS_HOSTS', 'android:value': 'api.example.com' } },
  ]);
  plugin.configureManifest(manifest, []);
  assert.equal(manifest.application[0]['meta-data'].length, 1);
});
