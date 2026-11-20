import type { TCustomerAddressSelect } from '@drizzle/schemas/crm.schema';
import { inject, injectable } from 'tsyringe';
import { CUSTOMER_ADDRESS_REPOSITORY_TOKEN } from '../constants/di';
import { CUSTOMER_SITE_MAX, type ICustomerAddressRepository, type TCustomerSiteInput } from '../contracts/customer-address.contract';
import { CustomerAddressNotFoundError, CustomerSiteLimitError } from '../errors/crm.errors';

/**
 * Customer addresses (ERP-0075), the CRM contract for the customer portal's
 * installation sites (kind `site`) and the staff read-out on the customer
 * page. Callers pass the customer id they resolved (the portal guard's, or
 * the route's after `customer:read`).
 */
@injectable()
export class CustomerAddressService {
	constructor(@inject(CUSTOMER_ADDRESS_REPOSITORY_TOKEN) private readonly addresses: ICustomerAddressRepository) {}

	/** Every live address of the customer, primary first. */
	list(customerId: string): Promise<TCustomerAddressSelect[]> {
		return this.addresses.list(customerId);
	}

	listSites(customerId: string): Promise<TCustomerAddressSelect[]> {
		return this.addresses.list(customerId, 'site');
	}

	/**
	 * Creates (no id) or updates a site. The first site becomes primary; an
	 * update without `primary` keeps the site's current flag.
	 *
	 * @throws {CustomerAddressNotFoundError} the id is not one of the customer's sites
	 * @throws {CustomerSiteLimitError} more than {@link CUSTOMER_SITE_MAX} sites
	 */
	async saveSite(customerId: string, input: TCustomerSiteInput, id?: string): Promise<TCustomerAddressSelect> {
		const sites = await this.addresses.list(customerId, 'site');
		const current = id ? sites.find((site) => site.id === id) : undefined;
		const data = {
			kind: 'site' as const,
			label: input.name,
			addressLine: input.address,
			contactName: input.picName,
			contactPhone: input.picPhone,
			isPrimary: input.primary ?? (current ? current.isPrimary : sites.length === 0),
		};
		if (id) {
			if (!current) throw new CustomerAddressNotFoundError();
			const updated = await this.addresses.update(customerId, id, data);
			if (!updated) throw new CustomerAddressNotFoundError();
			return updated;
		}
		if (sites.length >= CUSTOMER_SITE_MAX) throw new CustomerSiteLimitError(CUSTOMER_SITE_MAX);
		return this.addresses.create(customerId, data);
	}

	/**
	 * Removes a site; when it was the primary one, the oldest remaining site
	 * becomes primary.
	 *
	 * @throws {CustomerAddressNotFoundError} not one of the customer's sites
	 */
	async removeSite(customerId: string, id: string): Promise<void> {
		const sites = await this.addresses.list(customerId, 'site');
		const removed = sites.find((site) => site.id === id);
		if (!removed || !(await this.addresses.softDelete(customerId, id))) throw new CustomerAddressNotFoundError();
		const next = sites.filter((site) => site.id !== id).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
		if (removed.isPrimary && next) {
			await this.addresses.update(customerId, next.id, {
				kind: 'site',
				label: next.label ?? '',
				addressLine: next.addressLine ?? '',
				contactName: next.contactName ?? '',
				contactPhone: next.contactPhone ?? '',
				isPrimary: true,
			});
		}
	}
}
