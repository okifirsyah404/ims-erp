import { createHmac, timingSafeEqual } from 'node:crypto';
import { appConfig } from '@config/providers/config';

/**
 * Short-lived tokens that let the PDF renderer open a print view without a
 * session (ERP-0067). A token names one kind and one id, expires after
 * `ttlMs`, and is signed with the app secret: `<expiresAtMs>.<hex hmac>`.
 */
const sign = (kind: string, id: string, expiresAt: number, secret: string) =>
	createHmac('sha256', secret).update(`render:${kind}:${id}:${expiresAt}`).digest('hex');

export function createRenderToken(kind: string, id: string, ttlMs = 2 * 60 * 1000, secret = appConfig.app.secret): string {
	const expiresAt = Date.now() + ttlMs;
	return `${expiresAt}.${sign(kind, id, expiresAt, secret)}`;
}

/** True only for an unexpired token minted for this kind and id. */
export function verifyRenderToken(kind: string, id: string, token: string, secret = appConfig.app.secret): boolean {
	const [rawExpiry, given] = String(token).split('.');
	const expiresAt = Number(rawExpiry);
	if (!given || !Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
	const expected = sign(kind, id, expiresAt, secret);
	return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}
