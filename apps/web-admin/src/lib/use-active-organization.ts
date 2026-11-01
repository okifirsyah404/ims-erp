import { useSession } from './auth-client';
import { useOrganizations } from './use-permission';

/**
 * Resolves the organization the caller is currently acting in.
 *
 * @remarks
 * The active organization is a server-side session fact (`setActive` writes
 * it), so this hook never keeps its own copy. When the session has no
 * explicit active organization yet, the caller's first organization is used
 * as the fallback — matching the sidebar switcher's display rule, so the
 * admin pages and the switcher can never disagree about "the" organization.
 *
 * Returns `null` while the session is loading or the caller has no
 * membership; callers should render a placeholder rather than querying.
 */
export function useActiveOrganizationId(): string | null {
	const { data: session, isPending: sessionPending } = useSession();
	const activeOrganizationId = session?.session?.activeOrganizationId;

	// Only fetch the membership list when the session has no active org —
	// the common path resolves from the session alone.
	const { data: organizations } = useOrganizations();

	if (activeOrganizationId) return activeOrganizationId;
	if (sessionPending || !session?.user) return null;
	return organizations?.[0]?.id ?? null;
}
