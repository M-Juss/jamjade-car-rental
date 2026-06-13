type MaybePromise<T> = T | Promise<T>;

export type AuthTokenGetter = () => MaybePromise<string | null | undefined>;

let authToken: string | null = null;
let authTokenGetter: AuthTokenGetter | null = null;

export function setApiAuthToken(token: string | null) {
  authToken = token;
}

export function clearApiAuthToken() {
  authToken = null;
}

export function configureApiAuthTokenGetter(getter: AuthTokenGetter | null) {
  authTokenGetter = getter;
}

export async function getApiAuthToken() {
  const providerToken = await authTokenGetter?.();

  return providerToken ?? authToken;
}
