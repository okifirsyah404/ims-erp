import { z } from 'zod';

/**
 * Search-param contract of the single account settings page (`/accounts`,
 * ERP-0111).
 *
 * @remarks
 * Better Auth returns to this page from two flows that leave the app:
 * - email verification (`callbackURL`) — success lands on
 *   `?section=email&verified=1`, a bad link gets `&error=TOKEN_EXPIRED` /
 *   `INVALID_TOKEN` / … appended to the same URL;
 * - social account linking — success lands on `?section=connected&linked=1`,
 *   failure on `errorCallbackURL` (`?section=connected`) plus
 *   `&error=email_does_not_match` / … .
 *
 * Callback URLs carry no `#hash`: Better Auth appends query parameters to the
 * string, and a hash would swallow them. `section` replaces the anchor.
 */

/** Card ids on `/accounts`, in page order; also the DOM `id` of each card. */
export const ACCOUNT_SECTIONS = [
	'username',
	'email',
	'connected',
	'password',
	'sessions',
	// ERP-0122: the signed-in employee's payslips.
	'payslips',
] as const;

export type TAccountSection = (typeof ACCOUNT_SECTIONS)[number];

/** TanStack parses `?verified=1` as a number; normalise both shapes. */
const flag = z
	.union([z.literal(1), z.literal('1'), z.literal(true)])
	.optional()
	.catch(undefined);

export const accountsSearchSchema = z.object({
	section: z.enum(ACCOUNT_SECTIONS).optional().catch(undefined),
	verified: flag,
	linked: flag,
	error: z.string().optional().catch(undefined),
});

export type TAccountsSearch = z.infer<typeof accountsSearchSchema>;

/**
 * Absolute URL back to `/accounts` for a Better Auth redirect. Absolute
 * because the auth server runs on another origin: a relative callback would
 * resolve against the API host.
 */
export function accountsCallbackUrl(
	origin: string,
	section: TAccountSection,
	extra: Record<string, string> = {},
): string {
	const params = new URLSearchParams({ section, ...extra });
	return `${origin}/accounts?${params.toString()}`;
}

export type TVerificationOutcome = 'verified' | 'expired' | 'invalid';

/** Result of an email-verification link, or `null` when none is present. */
export function verificationOutcome(
	search: TAccountsSearch,
): TVerificationOutcome | null {
	if (search.section !== 'email') return null;
	if (search.error) return search.error === 'TOKEN_EXPIRED' ? 'expired' : 'invalid';
	return search.verified ? 'verified' : null;
}

export type TLinkOutcome =
	| 'linked'
	| 'emailMismatch'
	| 'linkedElsewhere'
	| 'failed';

/** Result of a social-link round trip, or `null` when none is present. */
export function linkOutcome(search: TAccountsSearch): TLinkOutcome | null {
	if (search.section !== 'connected') return null;
	switch (search.error) {
		case undefined:
			return search.linked ? 'linked' : null;
		case 'email_does_not_match':
			return 'emailMismatch';
		case 'account_already_linked_to_different_user':
			return 'linkedElsewhere';
		default:
			return 'failed';
	}
}

/** Username rule of Better Auth's username plugin (default validator). */
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/;
