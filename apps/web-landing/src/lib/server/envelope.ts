/** Unwraps the ERP success envelope `{ requestId, status, message, timestamp, data }`. */
export function unwrapEnvelope(body: unknown): unknown {
  return (body as { data?: unknown } | undefined)?.data;
}
