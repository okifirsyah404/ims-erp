/**
 * Cross-module port: resolve an organization slug to its id.
 *
 * @remarks
 * Consumed by the invitation pipeline so bulk invite rows (spreadsheet
 * files) can carry a human-readable `organizationSlug` instead of a UUID.
 * Implemented by the organization module's adapter over
 * `OrganizationRepository.findBySlug`; `user` never imports `organization`.
 */
export interface IOrganizationSlugResolverPort {
	/** Null when no live (non-soft-deleted) organization has this slug. */
	resolveIdBySlug(slug: string): Promise<string | null>;
}
