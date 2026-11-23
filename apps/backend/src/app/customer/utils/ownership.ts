import type { PortalRole, TCustomerCompanySelect, TCustomerSelect } from '@drizzle/schemas/customer.schema';

/**
 * The portal role a person really has (ERP-0114): ownership of a company is
 * `companies.owner_customer_id`, never the stored role. An individual owns
 * their own account; a company contact that is not the owner is staff, and a
 * stale stored `owner` reads as `viewer`.
 */
export function effectiveRole(
	person: Pick<TCustomerSelect, 'id' | 'companyId' | 'portalRole'>,
	company: Pick<TCustomerCompanySelect, 'ownerCustomerId'> | null,
): PortalRole {
	if (!person.companyId) return 'owner';
	if (company?.ownerCustomerId === person.id) return 'owner';
	const stored = person.portalRole as PortalRole | null;
	return stored && stored !== 'owner' ? stored : 'viewer';
}
