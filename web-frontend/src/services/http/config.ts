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

export function resolveAssetUrl(url?: string | null, baseUrl = getRuntimeApiBaseUrl()) {
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
