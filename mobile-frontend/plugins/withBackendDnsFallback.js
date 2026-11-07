const { withAndroidManifest } = require('expo/config-plugins');
const { isIP } = require('node:net');

const METADATA_NAME = 'com.jamjade.network.BACKEND_DNS_HOSTS';

function backendHosts(apiUrls = []) {
  const hosts = apiUrls.flatMap(value => {
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      if (url.protocol !== 'https:' || url.username || url.password ||
          isIP(host.replace(/^\[|\]$/g, '')) || !host.includes('.') ||
          host.endsWith('.local') || host.endsWith('.localhost') || host === 'dns.google' ||
          !/^[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9])?$/.test(host)) return [];
      return [host];
    } catch {
      return [];
    }
  });
  return [...new Set(hosts)];
}

function configureManifest(manifest, apiUrls) {
  const application = manifest.application?.[0];
  if (!application) throw new Error('Android application is missing');
  const entries = (application['meta-data'] ?? [])
    .filter(entry => entry.$?.['android:name'] !== METADATA_NAME);
  const hosts = backendHosts(apiUrls);
  if (hosts.length) entries.push({ $: {
    'android:name': METADATA_NAME,
    'android:value': hosts.join(','),
  } });
  application['meta-data'] = entries;
}

module.exports = (config, { apiUrls = [] } = {}) => withAndroidManifest(config, result => {
  configureManifest(result.modResults.manifest, apiUrls);
  return result;
});
module.exports.backendHosts = backendHosts;
module.exports.configureManifest = configureManifest;
