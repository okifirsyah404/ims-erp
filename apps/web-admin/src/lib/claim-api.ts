import type { TApiResponse } from '@ims-erp/common';

/**
 * Public claim API — no session exists yet, so this module intentionally
 * avoids the authed `admin-api` helper. Every request carries credentials
 * because the claim response sets the auto-login session cookie.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

/** Public claim-target info returned by `GET /invitations/claim/:token`. */
export type TClaimTarget = {
	email: string;
	name: string | null;
	type: 'app' | 'org';
};

/** Body for `POST /invitations/claim/:token` (form 1: credentials). */
export type TClaimInput = {
	username: string;
	password: string;
	phone: string;
};

async function parseJsonEnvelope<T>(response: Response): Promise<TApiResponse<T>> {
	try {
		return (await response.json()) as TApiResponse<T>;
	} catch {
		// Non-JSON error bodies (proxy page, empty body) — surface the status.
		return {} as TApiResponse<T>;
	}
}

async function request<T>(path: string, init?: RequestInit): Promise<TApiResponse<T>> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers:
			init?.body != null ? { 'Content-Type': 'application/json' } : undefined,
		...init,
	});
	const envelope = await parseJsonEnvelope<T>(response);
	if (!response.ok) {
		throw new Error(
			envelope.errors?.[0]?.message ??
				envelope.message ??
				`Request failed (${response.status})`,
		);
	}
	return envelope;
}

/** Resolves a claim token into the read-only invitee context for the form. */
export async function resolveClaimToken(token: string): Promise<TClaimTarget> {
	const envelope = await request<TClaimTarget>(`/invitations/claim/${token}`);
	return envelope.data as TClaimTarget;
}

/** Claims the invitation: creates credentials, signs the user in (set-cookie). */
export async function claimInvitation(token: string, input: TClaimInput) {
	const envelope = await request<{
		userId: string;
		organizationName: string | null;
		next: string;
	}>(`/invitations/claim/${token}`, {
		method: 'POST',
		body: JSON.stringify(input),
	});
	return envelope.data as {
		userId: string;
		organizationName: string | null;
		next: string;
	};
}

/**
 * Public username-availability feedback for the claim form. Returns the
 * availability boolean; network/validation errors surface as `null`.
 */
export async function isUsernameAvailable(username: string): Promise<boolean | null> {
	try {
		const envelope = await request<{ username: string; available: boolean }>(
			`/username-availability?username=${encodeURIComponent(username)}`,
		);
		return envelope.data?.available ?? null;
	} catch {
		return null;
	}
}
