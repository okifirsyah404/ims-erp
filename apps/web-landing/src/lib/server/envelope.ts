import type { TApiPaginatedResponse, TApiResponse } from "@ims-erp/common";

/**
 * Unwraps the ERP success envelope (`TApiResponse` / `TApiPaginatedResponse` from
 * `@ims-erp/common`): `{ requestId, status, message, timestamp, data }`.
 *
 * - A paginated envelope (`okPaginated`, it carries `pagination`) is unwrapped to
 *   `{ items: data, pagination }` so the shared `TPaginationMeta` contract survives.
 * - A body that is not an envelope yields `undefined`, never the raw body.
 */
export function unwrapEnvelope(body: unknown): unknown {
  const envelope = body as Partial<TApiResponse<unknown> | TApiPaginatedResponse<unknown>> | undefined;
  if (envelope && "pagination" in envelope && envelope.pagination) {
    return { items: envelope.data, pagination: envelope.pagination };
  }
  return envelope?.data;
}
