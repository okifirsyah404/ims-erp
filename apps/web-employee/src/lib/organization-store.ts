import { create } from 'zustand';

/**
 * The organization the caller is acting in, held on the client so every
 * surface (switcher, dashboard, API clients) reads one value.
 *
 * @remarks
 * The value is a **read-through cache of a server fact**: `organization.setActive`
 * writes `session.activeOrganizationId` server-side and remains authoritative
 * for authorization (ADR-0007). The store is seeded from the session by
 * `<OrganizationContextSync />` and only diverges from it while a switch is in
 * flight, which is why the sync writes on *change* rather than on every render.
 *
 * Deliberately not persisted to `localStorage`: a stale id would fire requests
 * at an organization the user may have been removed from.
 */
type TOrganizationState = {
	activeOrganizationId: string | null;
	/** Optimistic set; the caller is responsible for rolling back on failure. */
	setActive: (organizationId: string | null) => void;
	reset: () => void;
};

export const useOrganizationStore = create<TOrganizationState>((set) => ({
	activeOrganizationId: null,
	setActive: (activeOrganizationId) => set({ activeOrganizationId }),
	reset: () => set({ activeOrganizationId: null }),
}));

/** Active organization for non-React callers (API clients). */
export function getActiveOrganizationId(): string | null {
	return useOrganizationStore.getState().activeOrganizationId;
}

/**
 * Request headers that pin a call to the active organization.
 *
 * @remarks
 * The backend prefers `x-organization-id` over the session value and re-checks
 * membership on every request (`apps/backend/src/authorization/elysia-auth.ts`),
 * so a stale id yields 403, never another organization's data.
 */
export function organizationHeaders(): Record<string, string> {
	const organizationId = getActiveOrganizationId();
	return organizationId ? { 'x-organization-id': organizationId } : {};
}
