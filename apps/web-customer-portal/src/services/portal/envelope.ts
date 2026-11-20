import type { TApiPaginatedResponse, TApiResponse } from "@ims-erp/common";

/**
 * The ERP's success envelope (`ok()` / `created()` / `noContent()` in
 * apps/backend/src/http/response.ts), typed as `TApiResponse` / `TApiPaginatedResponse` in
 * `@ims-erp/common`: `{ requestId, status, message, timestamp, data }`.
 * `noContent()` answers 200 with `data: null`.
 */
export function unwrapEnvelope(body: unknown): unknown {
  if (body && typeof body === "object" && "data" in body) {
    return (body as TApiResponse<unknown> | TApiPaginatedResponse<unknown>).data;
  }
  return body;
}

/**
 * The real ERP always answers with the envelope, so it is unwrapped unless
 * `ERP_RESPONSE_ENVELOPE=none` is set explicitly (an unset variable must not silently
 * hand `{ requestId, data }` to the screens).
 */
export function envelopeUnwrapper(setting: "none" | "data" | undefined): ((body: unknown) => unknown) | undefined {
  return setting === "none" ? undefined : unwrapEnvelope;
}
