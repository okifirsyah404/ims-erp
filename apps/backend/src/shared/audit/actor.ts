/**
 * Audit actor context for the shared audit writer.
 *
 * @remarks
 * Mirrors the user module's `TActor`: resolved from the guard-resolved session
 * and request headers at the controller layer, never from client input. Every
 * field except `userId` is optional so internal callers (a posting service
 * writing a movement, a borrowing issuing stock) can pass through what they
 * have.
 */
export type TAuditActor = {
	userId: string;
	email?: string | null;
	ip?: string | null;
	userAgent?: string | null;
};

/** No-op actor for internal/system writes that have no session. */
export const SYSTEM_AUDIT_ACTOR: TAuditActor = {
	userId: 'system',
};
