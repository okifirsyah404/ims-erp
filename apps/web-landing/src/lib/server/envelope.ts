import type { TApiPaginatedResponse, TApiResponse } from "@ims-erp/common";

/**
 * Unwraps the ERP success envelope (`TApiResponse` / `TApiPaginatedResponse` from
 * `@ims-erp/common`): `{ requestId, status, message, timestamp, data }`. A body that is not
 * an envelope yields `undefined`, never the raw body.
 */
export function unwrapEnvelope(body: unknown): unknown {
  return (body as Partial<TApiResponse<unknown> | TApiPaginatedResponse<unknown>> | undefined)?.data;
}
