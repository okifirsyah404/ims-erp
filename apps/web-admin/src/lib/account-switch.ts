import { useEffect, useRef } from 'react';

import { useSession } from './auth-client';
import { queryClient } from './query-client';

/**
 * Account-switch hygiene for the admin SPA.
 *
 * Signing in, signing out, or signing in as someone else in another tab of
 * the same browser (the session cookie is shared) used to keep the previous
 * user's React Query cache and in-memory session alive, so a page could show
 * another account's buttons (e.g. "Approve" for a role without that grant).
 * The backend still refused the action; this module keeps the UI honest by
 * starting from a clean page whenever the signed-in account changes.
 */

/**
 * Accepts only same-origin absolute paths (`/x`), never protocol-relative or
 * backslash tricks (`//host`, `/\host`) or full URLs, so a `redirect` search
 * param cannot send the user off-site after a full-page navigation.
 */
export function safeRedirectPath(value: string | undefined | null): string {
	if (!value || !value.startsWith('/')) return '/';
	if (value.startsWith('//') || value.startsWith('/\\')) return '/';
	return value;
}

/** Drops every cached query and loads `href` as a fresh page. */
export function resetAndNavigate(href: string): void {
	queryClient.clear();
	window.location.assign(safeRedirectPath(href));
}

/**
 * Decides whether the page must reload: the account seen first on this page
 * (`initial`) differs from the one the session reports now (`current`).
 * `undefined` means "not resolved yet"; `null` means signed out.
 */
export function accountChanged(initial: string | null | undefined, current: string | null | undefined): boolean {
	if (initial === undefined || current === undefined) return false;
	return initial !== current;
}

/**
 * Reloads the page when the session user changes under it, e.g. another tab
 * signed in as a different account or signed out. Mounted once in the
 * authenticated shell.
 */
export function useReloadOnAccountSwitch(): void {
	const { data, isPending } = useSession();
	const current = isPending ? undefined : (data?.user.id ?? null);
	const initial = useRef<string | null | undefined>(undefined);

	useEffect(() => {
		if (current === undefined) return;
		if (initial.current === undefined) {
			initial.current = current;
			return;
		}
		if (accountChanged(initial.current, current)) {
			queryClient.clear();
			window.location.reload();
		}
	}, [current]);
}
