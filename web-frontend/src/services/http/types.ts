export type JsonRecord = Record<string, unknown>;

export type ApiResponse<TData = unknown> = {
  success: boolean;
  message: string;
  data: TData;
  meta?: JsonRecord;
  errors?: Record<string, string[]>;
};

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | JsonRecord | null;
  skipCsrf?: boolean;
};

export type ApiMethodOptions = Omit<ApiRequestOptions, "body" | "method">;
