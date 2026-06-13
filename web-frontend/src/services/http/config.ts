function normalizeBackendUrl(value?: string) {
  const rawUrl = value?.trim();

  if (!rawUrl) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_API in web-frontend/.env.local");
  }

  return rawUrl.replace(/\/+$/, "");
}

function isLoopbackHost(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function getRuntimeApiBaseUrl(baseUrl: string) {
  if (typeof window === "undefined") return baseUrl;

  try {
    const apiUrl = new URL(baseUrl);

    if (!isLoopbackHost(apiUrl.hostname) || !isLoopbackHost(window.location.hostname)) {
      return baseUrl;
    }

    apiUrl.hostname = window.location.hostname;

    return apiUrl.toString().replace(/\/+$/, "");
  } catch {
    return baseUrl;
  }
}

export const API_BASE_URL = normalizeBackendUrl(process.env.NEXT_PUBLIC_BACKEND_API);

export function buildApiUrl(path: string, baseUrl = API_BASE_URL) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${getRuntimeApiBaseUrl(baseUrl)}/${path.replace(/^\/+/, "")}`;
}
