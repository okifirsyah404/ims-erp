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
 * organization. There is deliberately NO "first organization" fallback:
 * with multiple organizations that would silently read another organization's
 * data. Callers must render a placeholder and send the user through the
 * organization switcher instead.
 */
export function useActiveOrganizationId(): string | null {
	return useOrganizationStore((state) => state.activeOrganizationId);
}
