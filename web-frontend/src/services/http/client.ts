import { buildApiUrl } from "./config";
import { ApiError, GENERIC_ERROR_MESSAGE } from "./errors";
import type { ApiMethodOptions, ApiRequestOptions, ApiResponse } from "./types";

function isFormData(body: unknown) {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

function isBlob(body: unknown) {
  return typeof Blob !== "undefined" && body instanceof Blob;
}

function isUrlSearchParams(body: unknown) {
  return typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams;
}

function isJsonBody(body: ApiRequestOptions["body"]) {
  return Boolean(body) &&
    typeof body === "object" &&
    !isFormData(body) &&
    !isBlob(body) &&
    !isUrlSearchParams(body);
}

function getCookie(name: string) {
  if (typeof document === "undefined") return null;

  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`));

  return cookie ? cookie.split("=").slice(1).join("=") : null;
}

function getXsrfToken() {
  const token = getCookie("XSRF-TOKEN");
  return token ? decodeURIComponent(token) : null;
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

let csrfRequest: Promise<void> | null = null;

export async function ensureCsrfCookie() {
  if (!csrfRequest) {
    csrfRequest = fetch(buildApiUrl("/sanctum/csrf-cookie"), {
      credentials: "include",
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new ApiError(GENERIC_ERROR_MESSAGE, response.status);
        }
      })
      .catch((error) => {
        if (error instanceof ApiError) throw error;

        throw new ApiError(GENERIC_ERROR_MESSAGE, 0);
      })
      .finally(() => {
        csrfRequest = null;
      });
  }

  return csrfRequest;
}

function getApiErrorMessage(status: number) {
  if (status === 401) {
    return "Your login session expired. Please log in again.";
  }

  if (status === 403) {
    return "You do not have permission to perform this action.";
  }

  if (status === 419) {
    return "Your login session expired. Please try again.";
  }

  if (status === 422) {
    return "Please check your information and try again.";
  }

  return GENERIC_ERROR_MESSAGE;
}

export async function apiFetch<TData = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResponse<TData>> {
  const {
    body,
    headers: requestHeaders,
    method: requestMethod,
    skipCsrf,
    ...fetchOptions
  } = options;
  const method = (requestMethod ?? "GET").toUpperCase();
  const shouldSendCsrf = !skipCsrf && !["GET", "HEAD", "OPTIONS"].includes(method);
  const headers = new Headers(requestHeaders);

  headers.set("Accept", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");

  let requestBody = body as BodyInit | null | undefined;

  if (isJsonBody(body)) {
    headers.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }

  if (shouldSendCsrf) {
    await ensureCsrfCookie();
    const xsrfToken = getXsrfToken();

    if (xsrfToken) {
      headers.set("X-XSRF-TOKEN", xsrfToken);
    }
  }

  const sendRequest = () => fetch(buildApiUrl(path), {
    ...fetchOptions,
    method,
    body: requestBody,
    credentials: fetchOptions.credentials ?? "include",
    headers,
  });

  let response: Response;

  try {
    response = await sendRequest();
  } catch {
    throw new ApiError(GENERIC_ERROR_MESSAGE, 0);
  }

  if (response.status === 419 && shouldSendCsrf) {
    await ensureCsrfCookie();
    const xsrfToken = getXsrfToken();

    if (xsrfToken) {
      headers.set("X-XSRF-TOKEN", xsrfToken);
    }

    try {
      response = await sendRequest();
    } catch {
      throw new ApiError(GENERIC_ERROR_MESSAGE, 0);
    }
  }

  const text = await response.text();
  const payload = text ? tryParseJson(text) : null;

  if (!response.ok) {
    const validationErrors =
      payload &&
      typeof payload === "object" &&
      "errors" in payload &&
      payload.errors &&
      typeof payload.errors === "object"
        ? payload.errors as Record<string, string[]>
        : undefined;

    throw new ApiError(
      getApiErrorMessage(response.status),
      response.status,
      validationErrors,
    );
  }

  return payload as ApiResponse<TData>;
}

export function apiGet<TData = unknown>(path: string, options: ApiMethodOptions = {}) {
  return apiFetch<TData>(path, { ...options, method: "GET" });
}

export function apiPost<TData = unknown>(
  path: string,
  body?: ApiRequestOptions["body"],
  options: ApiMethodOptions = {},
) {
  return apiFetch<TData>(path, { ...options, method: "POST", body });
}

export function apiPut<TData = unknown>(
  path: string,
  body?: ApiRequestOptions["body"],
  options: ApiMethodOptions = {},
) {
  return apiFetch<TData>(path, { ...options, method: "PUT", body });
}

export function apiPatch<TData = unknown>(
  path: string,
  body?: ApiRequestOptions["body"],
  options: ApiMethodOptions = {},
) {
  return apiFetch<TData>(path, { ...options, method: "PATCH", body });
}

export function apiDelete<TData = unknown>(
  path: string,
  body?: ApiRequestOptions["body"],
  options: ApiMethodOptions = {},
) {
  return apiFetch<TData>(path, { ...options, method: "DELETE", body });
}

export const authFetch = apiFetch;
