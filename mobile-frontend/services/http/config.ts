import Constants from 'expo-constants';

function isLocalDevelopmentHost(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();

  if (normalized === 'localhost' || normalized === '::1') {
    return true;
  }

  const octets = normalized.split('.').map(Number);

  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  return octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168);
}

function getDevelopmentHost() {
  const hostUri = Constants.expoConfig?.hostUri;

  if (!hostUri) {
    return null;
  }

  try {
    const url = new URL(
      /^[a-z]+:\/\//i.test(hostUri) ? hostUri : `http://${hostUri}`,
    );

    return url.hostname.replace(/^\[|\]$/g, '');
  } catch {
    return hostUri
      .replace(/^[a-z]+:\/\//i, '')
      .split(':')[0];
  }
}

const developmentHost = getDevelopmentHost();
const isExpoLanMode = Boolean(
  developmentHost && isLocalDevelopmentHost(developmentHost),
);
const DEFAULT_BACKEND_API_URL = isExpoLanMode
  ? `http://${developmentHost}:8000/api`
  : 'http://localhost:8000/api';

function useCurrentDevelopmentHost(rawUrl: string) {
  if (!isExpoLanMode || !developmentHost) {
    return rawUrl;
  }

  try {
    const apiUrl = new URL(rawUrl);

    if (!isLocalDevelopmentHost(apiUrl.hostname)) {
      return rawUrl;
    }

    apiUrl.hostname = developmentHost;

    return apiUrl.toString();
  } catch {
    return rawUrl;
  }
}

function normalizeBackendApiUrl(value?: string) {
  const rawUrl = value?.trim() || DEFAULT_BACKEND_API_URL;

  return useCurrentDevelopmentHost(rawUrl).replace(/\/+$/, '');
}

const configuredPrimaryApiUrl =
  process.env.EXPO_PUBLIC_BACKEND_API ??
    process.env.EXPO_PUBLIC_BACKEND_URL ??
    process.env.EXPO_PUBLIC_API_URL;
const configuredTunnelApiUrl =
  process.env.EXPO_PUBLIC_BACKEND_TUNNEL_API ??
    process.env.EXPO_PUBLIC_BACKEND_FALLBACK_API;
const localApiUrl = normalizeBackendApiUrl(configuredPrimaryApiUrl);
const tunnelApiUrl = configuredTunnelApiUrl
  ? normalizeBackendApiUrl(configuredTunnelApiUrl)
  : null;

const orderedApiBaseUrls = !configuredPrimaryApiUrl && !isExpoLanMode && tunnelApiUrl
  ? [tunnelApiUrl, localApiUrl]
  : [localApiUrl, tunnelApiUrl];

export const API_BASE_URLS = [...new Set(
  orderedApiBaseUrls.filter((url): url is string => Boolean(url)),
)];

export const API_BASE_URL = API_BASE_URLS[0];

export const API_NETWORK_FALLBACK_TIMEOUT_MS = Math.max(
  1000,
  Number(process.env.EXPO_PUBLIC_BACKEND_FALLBACK_TIMEOUT_MS) || 4000,
);

export function buildApiUrl(path: string, baseUrl = API_BASE_URL) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${baseUrl}/${path.replace(/^\/+/, '')}`;
}

export function buildApiUrls(path: string, preferredBaseUrl?: string | null) {
  if (/^https?:\/\//i.test(path)) {
    return [{ baseUrl: null, url: path }];
  }

  const baseUrls = preferredBaseUrl
    ? [preferredBaseUrl, ...API_BASE_URLS.filter((baseUrl) => baseUrl !== preferredBaseUrl)]
    : API_BASE_URLS;

  return baseUrls.map((baseUrl) => ({
    baseUrl,
    url: buildApiUrl(path, baseUrl),
  }));
}
