import { useSession } from './auth-client';

/**
 * Resolves the organization the caller is currently acting in.
 *
 * @remarks
 * The active organization is a server-side session fact (`setActive` writes
 * it), so this hook never keeps its own copy.
 *
 * Returns `null` while the session is loading or the caller has no active
 * organization. There is deliberately NO "first organization" fallback:
 * with multiple organizations (ADR-0007) that would silently read another
 * organization's data. Callers must render a placeholder and send the user
 * through the organization switcher instead.
 */
export function useActiveOrganizationId(): string | null {
	const { data: session, isPending: sessionPending } = useSession();
	const activeOrganizationId = session?.session?.activeOrganizationId;

	if (activeOrganizationId) return activeOrganizationId;
	if (sessionPending || !session?.user) return null;
	return null;
}
