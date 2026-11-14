import { hasRole } from '@ims-erp/common';
import { useSession } from './auth-client';

/**
 * Whether the caller holds the platform administrator role.
 *
 * @remarks
 * UX only — the backend re-authorizes every request. `isPending` lets callers
 * avoid rendering a "not allowed" state before the session resolves.
 */
export function useIsAppAdmin(): { isAppAdmin: boolean; isPending: boolean } {
	const { data: session, isPending } = useSession();
	return {
		isAppAdmin: hasRole(session?.user?.role, 'admin'),
		isPending,
	};
}
