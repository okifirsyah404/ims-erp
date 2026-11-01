import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Single-use invitation token utilities. The raw token lives only in the
 * emailed link; the database stores a SHA-256 hash (lookup + timing-safe
 * compare), so a DB leak never yields usable invitation links.
 */

/** 3-day invitation expiry (locked decision D2). */
export const INVITATION_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/** Generates a new raw token and its hash. */
export function generateInvitationToken(): {
	token: string;
	tokenHash: string;
} {
	const token = randomBytes(32).toString('base64url');
	return { token, tokenHash: hashToken(token) };
}

/** SHA-256 hash used for storage and lookup. */
export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/** Timing-safe comparison of a raw token against a stored hash. */
export function verifyToken(token: string, tokenHash: string): boolean {
	const candidate = Buffer.from(hashToken(token), 'hex');
	const stored = Buffer.from(tokenHash, 'hex');
	if (candidate.length !== stored.length) return false;
	return timingSafeEqual(candidate, stored);
}
