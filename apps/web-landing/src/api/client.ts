/**
 * Duplicated on purpose: the website (apps/web-landing) and the portal
 * (apps/web-customer-portal) are separate Astro deployments and may not import
 * from each other. Keep the two copies of this file identical.
 */
export type ApiClientOptions = {
  baseUrl: string;
  fetcher?: typeof fetch;
  /** Bearer token sent with every request (server-side only), e.g. the website's API key. */
  token?: string;
  /**
   * ERP session cookie (`name=value`) sent as the `Cookie` header with every request
   * (server-side only): the customer portal session (ERP-0069, ADR-0024).
   */
  sessionCookie?: string;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
  /** Extra attempts for idempotent requests (GET) on network errors and 502/503/504. */
  retries?: number;
  defaultHeaders?: Record<string, string>;
  /**
   * Unwraps a success envelope, e.g. NestJS interceptors returning `{ data: … }`.
   * Defaults to identity (the body is the payload).
   */
  unwrap?: (body: unknown) => unknown;
};

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | undefined | null | (string | number)[]>;
  /** Plain objects are sent as JSON; FormData is sent as multipart. */
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Sent as `Idempotency-Key` so the ERP can de-duplicate retried mutations. */
  idempotencyKey?: string;
  /** Called with the successful response before its body is read (e.g. to read `Set-Cookie`). */
  onResponse?: (response: Response) => void;
};

/** Error thrown for non-2xx ERP responses and network failures (`status` 0). */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  /** Human-readable messages from an ERP error body (`errors[].message`, or `message`). */
  readonly messages: string[];
  readonly requestId?: string;

  constructor(message: string, status: number, body?: unknown, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.messages = errorMessages(body);
    this.requestId = requestId;
  }
}

/**
 * Reads an ERP error body into a list of messages: the envelope's `errors[].message`
 * (`{ status, message, errors }`) first, else a NestJS-style `message: string | string[]`.
 */
function errorMessages(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const errors = (body as { errors?: unknown }).errors;
  if (Array.isArray(errors)) {
    const listed = errors
      .map((item) => (item && typeof item === "object" ? (item as { message?: unknown }).message : undefined))
      .filter((m): m is string => typeof m === "string" && m.length > 0);
    if (listed.length > 0) return listed;
  }
  const message = (body as { message?: unknown }).message;
  if (typeof message === "string") return [message];
  if (Array.isArray(message)) return message.filter((m): m is string => typeof m === "string");
  return [];
}

/**
 * Joins `path` onto `baseUrl` and refuses anything that would leave the ERP origin
 * (absolute URLs, `//host`, `..` tricks), so credentials can't be sent elsewhere.
 */
function buildUrl(baseUrl: string, path: string, query?: RequestOptions["query"]): string {
  const base = new URL(baseUrl);
  if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith("//")) {
    throw new ApiError(`Refusing absolute ERP path "${path}"`, 0);
  }
  const basePath = base.pathname.replace(/\/$/, "");
  const url = new URL(`${base.origin}${basePath}/${path.replace(/^\//, "")}`);
  if (url.origin !== base.origin || (url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`))) {
    throw new ApiError(`ERP path "${path}" escapes the configured base URL`, 0);
  }
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, String(v)));
    else url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return response.json();
  return response.text();
}

const RETRYABLE_STATUS = new Set([502, 503, 504]);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createApiClient({
  baseUrl,
  fetcher = fetch,
  token,
  sessionCookie,
  timeoutMs = 15_000,
  retries = 1,
  defaultHeaders = {},
  unwrap = (body) => body,
}: ApiClientOptions) {
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", query, body, headers = {}, signal, idempotencyKey, onResponse } = options;
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    const url = buildUrl(baseUrl, path, query);
    const requestId = crypto.randomUUID();
    const attempts = method === "GET" ? retries + 1 : 1;

    for (let attempt = 1; ; attempt++) {
      const timeout = AbortSignal.timeout(timeoutMs);
      let response: Response;
      try {
        response = await fetcher(url, {
          method,
          headers: {
            Accept: "application/json",
            "X-Request-Id": requestId,
            ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
            ...defaultHeaders,
            ...headers,
            // Last so callers can't override or drop them by accident.
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(sessionCookie ? { Cookie: sessionCookie } : {}),
          },
          body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
          cache: "no-store",
          // Never follow redirects with credentials attached.
          redirect: "error",
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
      } catch (error) {
        if (attempt < attempts && !signal?.aborted) {
          await sleep(250 * attempt);
          continue;
        }
        throw new ApiError(`ERP API request failed: ${(error as Error).message}`, 0, undefined, requestId);
      }

      if (RETRYABLE_STATUS.has(response.status) && attempt < attempts) {
        await response.body?.cancel();
        await sleep(250 * attempt);
        continue;
      }

      const payload = await parseBody(response).catch(() => undefined);
      if (!response.ok) {
        throw new ApiError(`ERP API error: ${response.status}`, response.status, payload, requestId);
      }
      onResponse?.(response);
      return unwrap(payload) as T;
    }
  }

  return {
    request,
    get<T>(path: string, options?: Omit<RequestOptions, "method" | "body">) {
      return request<T>(path, { ...options, method: "GET" });
    },
    post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) {
      return request<T>(path, { ...options, method: "POST", body });
    },
    patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) {
      return request<T>(path, { ...options, method: "PATCH", body });
    },
    delete<T>(path: string, options?: Omit<RequestOptions, "method" | "body">) {
      return request<T>(path, { ...options, method: "DELETE" });
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
