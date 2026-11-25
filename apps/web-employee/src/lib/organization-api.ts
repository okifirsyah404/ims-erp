import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';

/**
 * Minimal read of `GET /organizations/mine`.
 *
 * @remarks
 * The portal only needs organization *names* for the switcher: every
 * organization it can act in comes from `/human-resources/me/context`, and this
 * endpoint supplies the label. Nothing here grants access.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type TMyOrganization = {
	id: string;
	name: string;
	slug: string;
	logo: string | null;
	role: string;
};

async function listMyOrganizations(): Promise<TMyOrganization[]> {
	const response = await fetch(`${API_URL}/organizations/mine`, { credentials: 'include' });
	const envelope = (await response.json()) as TApiResponse<TMyOrganization[]> &
		Partial<TApiPaginatedResponse<TMyOrganization>>;
	if (!response.ok) {
		throw new Error(
			envelope.errors?.[0]?.message ?? envelope.message ?? `Request failed (${response.status})`,
		);
	}
	return envelope.data ?? [];
}

/** Membership rows of the caller (used for display names only). */
export const myOrganizationsQueryOptions = queryOptions({
	queryKey: ['my-organizations'] as const,
	queryFn: listMyOrganizations,
});
