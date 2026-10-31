import type { TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';

/**
 * Shape of `GET /users/me`'s `data` (the user module's self profile).
 *
 * @remarks
 * Mirrors the backend's `TUserProfile` (`TUserSelect` with `image` carrying
 * a short-lived presigned S3 GET URL, or null). Kept local to the frontend
 * on purpose: the envelope type comes from `@ims-erp/common`, the row shape
 * tracks the auth schema the backend projects.
 */
export type TSelfUser = {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image: string | null;
	role: string | null;
	banned: boolean;
	username: string | null;
	displayUsername: string | null;
	bio: string | null;
};

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function fetchSelfUser(): Promise<TSelfUser> {
	const response = await fetch(`${API_URL}/users/me`, {
		credentials: 'include',
	});
	const envelope = (await response.json()) as TApiResponse<TSelfUser>;
	if (!response.ok || !envelope.data) {
		throw new Error(envelope.message ?? 'Failed to load user');
	}
	return envelope.data;
}

/**
 * Self session user (`GET /users/me`). The backend is authoritative for
 * profile fields and the presigned avatar URL; pending/error states must
 * be handled by the consumer (the sidebar degrades, never blocks).
 */
export const selfUserQueryOptions = queryOptions({
	queryKey: ['users', 'me'] as const,
	queryFn: fetchSelfUser,
	staleTime: 60_000,
	retry: 1,
});
