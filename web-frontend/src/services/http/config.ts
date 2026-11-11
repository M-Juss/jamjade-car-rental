function normalizeBackendUrl(value?: string) {
  const rawUrl = value?.trim();

  if (!rawUrl) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_API in web-frontend/.env.local");
  }

  return rawUrl.replace(/\/+$/, "");
}

const LOCAL_API_BASE_URL = normalizeBackendUrl(process.env.NEXT_PUBLIC_BACKEND_API);
const TUNNEL_API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_API_TUNNEL
  ? normalizeBackendUrl(process.env.NEXT_PUBLIC_BACKEND_API_TUNNEL)
  : null;

function isLoopbackHost(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function getRuntimeApiBaseUrl() {
  if (typeof window === "undefined") return LOCAL_API_BASE_URL;

  const browserHostname = window.location.hostname;

  if (TUNNEL_API_BASE_URL && !isLoopbackHost(browserHostname)) {
    return TUNNEL_API_BASE_URL === "same-origin"
      ? window.location.origin
      : TUNNEL_API_BASE_URL;
  }

  try {
    const apiUrl = new URL(LOCAL_API_BASE_URL);

    if (!isLoopbackHost(apiUrl.hostname) || !isLoopbackHost(browserHostname)) {
      return LOCAL_API_BASE_URL;
    }

    apiUrl.hostname = browserHostname;

    return apiUrl.toString().replace(/\/+$/, "");
  } catch {
    return LOCAL_API_BASE_URL;
  }
}

export function getApiBaseUrl() {
  return getRuntimeApiBaseUrl();
}

export function buildApiUrl(path: string, baseUrl = getRuntimeApiBaseUrl()) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${baseUrl}/${path.replace(/^\/+/, "")}`;
}

const vehicleCutouts: Record<string, string> = {
  "UDEO7laaeVUfknxJp8NpRbBICIpYay8zSyWT3alt.jpg": "toyota-vios-red.png",
  "44Uk0Cq0cGPjXmtZBNMQ58e6IzANtaugZ7pkQQmD.jpg": "honda-brv-2020.png",
  "JneuHefkuFQfyDuBYIO05nbp0pFqd8gejYfo9YpA.jpg": "toyota-avanza-2022.png",
  "Z5P2AorYIAMFLngtJQSFBpLFgVSgZ4YemlWdH5gz.jpg": "toyota-hiace-2019.png",
  "qOZY9KSRWygyWiP5zTKSGBX5RYauxnpz82lG0qqj.jpg": "toyota-hiace-2024.png",
  "T0EQm3GUYyrw6jLJvbxjJ5UiG62lcgmcPHLw9SyC.jpg": "toyota-innova-2025.png",
  "wOwmXCdUwf5nV3KtscuBS82hJAquwAk2qtcwkMtY.jpg": "toyota-innova-2026.png",
  "vtbylE5jp7aRRLaL7hkHwsAKi3ZxCIgmSe1UBcRf.jpg": "toyota-vios-2018.png",
};

export function resolveAssetUrl(url?: string | null, baseUrl = getRuntimeApiBaseUrl()) {
  const filename = url?.split(/[?#]/, 1)[0].match(/(?:^|\/)vehicles\/([^/]+)$/)?.[1];
  if (filename && vehicleCutouts[filename]) return `/vehicles-transparent/${vehicleCutouts[filename]}`;

  if (!url) return null;

  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);

      if (isLoopbackHost(parsed.hostname)) {
        return `${baseUrl}${parsed.pathname}${parsed.search}`;
      }
    } catch {
      return url;
    }

    return url;
  }

  return `${baseUrl}/${url.replace(/^\/+/, "")}`;
}
