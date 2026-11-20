import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM helpers for the gateway secrets (ADR-0024 Q18).
 *
 * @remarks
 * The key lives in `PAYMENT_SECRET_KEY` (environment, never in the database).
 * Every encryption uses a fresh 12-byte IV; the GCM tag is stored beside the
 * ciphertext, so a tampered row fails to decrypt instead of yielding garbage.
 * Nothing here logs; callers pass the key in.
 */

export type TSealedSecret = {
	ciphertext: string;
	iv: string;
	tag: string;
};

const ALGORITHM = 'aes-256-gcm';

/** Parses the 32-byte key (64 hex chars or base64) and rejects anything else. */
export function paymentSecretKey(raw: string): Buffer {
	const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
	if (key.length !== 32) throw new Error('PAYMENT_SECRET_KEY must decode to 32 bytes');
	return key;
}

/** Encrypts a secret with a fresh IV. */
export function sealSecret(plaintext: string, key: Buffer): TSealedSecret {
	const iv = randomBytes(12);
	const cipher = createCipheriv(ALGORITHM, key, iv);
	const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	return {
		ciphertext: ciphertext.toString('base64'),
		iv: iv.toString('base64'),
		tag: cipher.getAuthTag().toString('base64'),
	};
}

/**
 * Decrypts a sealed secret.
 *
 * @throws {Error} When the key changed or the row was tampered with
 */
export function openSecret(sealed: TSealedSecret, key: Buffer): string {
	const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(sealed.iv, 'base64'));
	decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
	return Buffer.concat([
		decipher.update(Buffer.from(sealed.ciphertext, 'base64')),
		decipher.final(),
	]).toString('utf8');
}

/** Last four characters, so staff can recognise which secret is loaded. */
export function last4(plaintext: string): string {
	return plaintext.slice(-4);
}
