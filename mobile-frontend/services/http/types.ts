export type JsonRecord = Record<string, unknown>;

export type ApiResponse<TData = unknown> = {
  success: boolean;
  message: string;
  data: TData;
  meta?: JsonRecord;
  errors?: Record<string, string[]>;
};

export type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  allowNetworkFallback?: boolean;
  authToken?: string | null;
  body?: BodyInit | JsonRecord | null;
  responseTimeoutMs?: number;
  skipAuth?: boolean;
};

export type ApiMethodOptions = Omit<ApiRequestOptions, 'body' | 'method'>;
