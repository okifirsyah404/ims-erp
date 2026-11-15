'use client';

import { useEffect } from 'react';
import { useSession } from '@/lib/auth-client';
import { useOrganizationStore } from '@/lib/organization-store';

/**
 * Mirrors the session's active organization into the client store.
 *
 * @remarks
 * Mounted once in the authenticated shell. It writes **only when the session
 * value changes**, so an optimistic switch is not clobbered by a re-render, and
 * a server-side change (another tab, revoked membership, fresh login) still
 * reaches every consumer.
 *
 * Renders nothing.
 */
export function OrganizationContextSync() {
	const { data: session } = useSession();
	const userId = session?.user?.id ?? null;
	const activeOrganizationId = session?.session?.activeOrganizationId ?? null;
	const setActive = useOrganizationStore((state) => state.setActive);
	const reset = useOrganizationStore((state) => state.reset);

	useEffect(() => {
		if (!userId) {
			reset();
			return;
		}
		setActive(activeOrganizationId);
	}, [activeOrganizationId, userId, setActive, reset]);

	return null;
}
