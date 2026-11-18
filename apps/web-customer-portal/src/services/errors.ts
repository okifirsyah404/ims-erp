import { ApiError, ErpContractError, PortalNotConfiguredError } from "@ims-erp/api-client";

/** The ERP rejected the session's access token; the user must sign in again. */
export class SessionExpiredError extends Error {
  constructor() {
    super("ERP session expired");
    this.name = "SessionExpiredError";
  }
}

/** Server log line for upstream failures. Never includes tokens or request bodies. */
export function logUpstreamError(scope: string, error: unknown) {
  if (error instanceof ApiError) {
    console.error(`[${scope}] ERP ${error.status || "network"} error`, { requestId: error.requestId, messages: error.messages });
  } else if (error instanceof ErpContractError) {
    console.error(`[${scope}] ERP contract mismatch`, error.issues.slice(0, 10));
  } else if (error instanceof PortalNotConfiguredError) {
    console.warn(`[${scope}] ${error.message}`);
  } else {
    console.error(`[${scope}] unexpected error`, error);
  }
}

/**
 * For page sections whose ERP operation is not connected yet (the ERP ships the portal
 * in stages, see ./portal/erp-routes.ts): returns `fallback` for a PortalNotConfiguredError
 * so the rest of the page still renders. Every other error is rethrown.
 */
export async function unlessNotConnected<T>(promise: Promise<T>, fallback: T, scope: string): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (!(error instanceof PortalNotConfiguredError)) throw error;
    logUpstreamError(scope, error);
    return fallback;
  }
}
