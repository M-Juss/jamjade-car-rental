import { getApiAuthToken } from './auth-token';
import {
  API_NETWORK_FALLBACK_TIMEOUT_MS,
  buildApiUrls,
} from './config';
import { ApiError, GENERIC_ERROR_MESSAGE } from './errors';
import type { ApiMethodOptions, ApiRequestOptions, ApiResponse } from './types';

function isFormData(body: unknown) {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

function isBlob(body: unknown) {
  return typeof Blob !== 'undefined' && body instanceof Blob;
}

function isUrlSearchParams(body: unknown) {
  return typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams;
}

function isJsonBody(body: ApiRequestOptions['body']) {
  return Boolean(body) &&
    typeof body === 'object' &&
    !isFormData(body) &&
    !isBlob(body) &&
    !isUrlSearchParams(body);
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      message: text,
      data: null,
    };
  }
}

function getApiErrorMessage(status: number) {
  if (status === 401 || status === 419) {
    return 'Your session expired. Please sign in again.';
  }

  if (status === 403) {
    return 'You do not have permission to perform this action.';
  }

  if (status === 422) {
    return 'Please check your information and try again.';
  }

  return GENERIC_ERROR_MESSAGE;
}

let activeApiBaseUrl: string | null = null;

function canRetryOnAnotherApi(method: string, allowNetworkFallback?: boolean) {
  return allowNetworkFallback ||
    method === 'GET' ||
    method === 'HEAD' ||
    method === 'OPTIONS';
}

async function fetchWithFallbackTimeout(
  url: string,
  options: RequestInit,
  useTimeout: boolean,
) {
  if (!useTimeout) {
    return fetch(url, options);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    API_NETWORK_FALLBACK_TIMEOUT_MS,
  );
  const requestSignal = options.signal;
  const abortFromRequest = () => controller.abort();

  if (requestSignal?.aborted) {
    controller.abort();
  } else {
    requestSignal?.addEventListener('abort', abortFromRequest, { once: true });
  }

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    requestSignal?.removeEventListener('abort', abortFromRequest);
  }
}

export async function apiFetch<TData = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResponse<TData>> {
  const {
    allowNetworkFallback,
    authToken,
    body,
    headers: requestHeaders,
    method: requestMethod,
    skipAuth,
    ...fetchOptions
  } = options;
  const method = (requestMethod ?? 'GET').toUpperCase();
  const headers = new Headers(requestHeaders);

  headers.set('Accept', 'application/json');

  let requestBody = body as BodyInit | null | undefined;

  if (isJsonBody(body)) {
    headers.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(body);
  }

  if (!skipAuth) {
    const token = authToken ?? await getApiAuthToken();

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  let response: Response | null = null;
  const apiCandidates = buildApiUrls(path, activeApiBaseUrl);
  const canFallback = canRetryOnAnotherApi(method, allowNetworkFallback);
  let lastNetworkError: unknown;

  for (const [index, candidate] of apiCandidates.entries()) {
    const hasAnotherCandidate = index < apiCandidates.length - 1;

    try {
      response = await fetchWithFallbackTimeout(candidate.url, {
        ...fetchOptions,
        method,
        body: requestBody,
        headers,
      }, canFallback && hasAnotherCandidate);
      if (candidate.baseUrl) {
        activeApiBaseUrl = candidate.baseUrl;
      }
      lastNetworkError = null;
      break;
    } catch (error) {
      lastNetworkError = error;

      if (fetchOptions.signal?.aborted || !canFallback || !hasAnotherCandidate) {
        break;
      }
    }
  }

  if (!response) {
    activeApiBaseUrl = null;
    void lastNetworkError;
    throw new ApiError('Unable to connect right now. Please try again.', 0);
  }

  const text = await response.text();
  const payload = text ? tryParseJson(text) : null;

  if (!response.ok) {
    throw new ApiError(getApiErrorMessage(response.status), response.status);
  }

  return payload as ApiResponse<TData>;
}

export function apiGet<TData = unknown>(path: string, options: ApiMethodOptions = {}) {
  return apiFetch<TData>(path, { ...options, method: 'GET' });
}

export function apiPost<TData = unknown>(
  path: string,
  body?: ApiRequestOptions['body'],
  options: ApiMethodOptions = {},
) {
  return apiFetch<TData>(path, { ...options, method: 'POST', body });
}

export function apiPut<TData = unknown>(
  path: string,
  body?: ApiRequestOptions['body'],
  options: ApiMethodOptions = {},
) {
  return apiFetch<TData>(path, { ...options, method: 'PUT', body });
}

export function apiPatch<TData = unknown>(
  path: string,
  body?: ApiRequestOptions['body'],
  options: ApiMethodOptions = {},
) {
  return apiFetch<TData>(path, { ...options, method: 'PATCH', body });
}

export function apiDelete<TData = unknown>(
  path: string,
  body?: ApiRequestOptions['body'],
  options: ApiMethodOptions = {},
) {
  return apiFetch<TData>(path, { ...options, method: 'DELETE', body });
}

export const authFetch = apiFetch;
