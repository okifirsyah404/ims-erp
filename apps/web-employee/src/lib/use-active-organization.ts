import { useOrganizationStore } from './organization-store';

/**
 * Resolves the organization the caller is currently acting in.
 *
 * @remarks
 * The value is a **server fact**: `organization.setActive` writes
 * `session.activeOrganizationId` (ADR-0007), and the backend enforces
 * membership and permissions from it. The client store mirrors that fact so
 * every surface reads one value — see `organization-store.ts` and
 * `<OrganizationContextSync />`, which re-seeds it whenever the session changes.
 *
 * Returns `null` while the session is loading or the caller has no active
 * organization. There is deliberately NO "first organization" fallback: the
 * server always activates the single company organization (K12, M12-2), so a
 * missing value means "not resolved yet", not "pick any".
 */
export function useActiveOrganizationId(): string | null {
	return useOrganizationStore((state) => state.activeOrganizationId);
}
