import { LOCATION_SERVICE_TOKEN } from '@app/location/constants/di';
import type { LocationService } from '@app/location/services/location.service';
import { isUniqueViolation } from '@drizzle/errors';
import type { TCustomerContactSelect, TCustomerSelect } from '@drizzle/schemas/crm.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import { CUSTOMER_CONTACT_REPOSITORY_TOKEN, CUSTOMER_REPOSITORY_TOKEN } from '../constants/di';
import type {
	TCreateContactInput,
	TCreateCustomerInput,
	TCustomerListQuery,
	TUpdateContactInput,
	TUpdateCustomerInput,
} from '../contracts/customer.contract';
import type {
	ICustomerContactRepository,
	ICustomerRepository,
} from '../contracts/customer.repository.interface';
import {
	CustomerCodeTakenError,
	CustomerContactNotFoundError,
	CustomerNotFoundError,
	CustomerStatusUnchangedError,
	VillageNotFoundError,
} from '../errors/crm.errors';

export type TCustomerDetail = TCustomerSelect & { contacts: TCustomerContactSelect[] };

/**
 * Customer master-data use cases (company-wide, ADR-0011).
 *
 * @remarks
 * This is the module's exported API: sales and other modules call
 * {@link CustomerService.getActiveCustomer} instead of reading CRM tables.
 * The address village is validated through the Location module's service.
 */
@injectable()
export class CustomerService {
	constructor(
		@inject(CUSTOMER_REPOSITORY_TOKEN)
		private readonly customers: ICustomerRepository,
		@inject(CUSTOMER_CONTACT_REPOSITORY_TOKEN)
		private readonly contacts: ICustomerContactRepository,
		@inject(LOCATION_SERVICE_TOKEN)
		private readonly locations: Pick<LocationService, 'getVillage'>,
	) {}

	private async assertVillage(villageId: string | null | undefined) {
		if (villageId && !(await this.locations.getVillage(villageId))) throw new VillageNotFoundError();
	}

	private async assertCodeFree(code: string, exceptId?: string) {
		const existing = await this.customers.findByCode(code);
		if (existing && existing.id !== exceptId) throw new CustomerCodeTakenError(code);
	}

	private async requireCustomer(id: string): Promise<TCustomerSelect> {
		const customer = await this.customers.findById(id);
		if (!customer) throw new CustomerNotFoundError();
		return customer;
	}

	list(query: TCustomerListQuery): Promise<TPaginationResult<TCustomerSelect>> {
		return this.customers.paginate(query);
	}

	async get(id: string): Promise<TCustomerDetail> {
		const customer = await this.requireCustomer(id);
		return { ...customer, contacts: await this.contacts.listByCustomer(id) };
	}

	/** An active customer, or `null` — for modules referencing customers on new documents. */
	async getActiveCustomer(id: string): Promise<TCustomerSelect | null> {
		const customer = await this.customers.findById(id);
		return customer?.status === 'active' ? customer : null;
	}

	/** A live contact of the customer, or `null` — for documents naming the attention person. */
	getContact(customerId: string, contactId: string): Promise<TCustomerContactSelect | null> {
		return this.contacts.findById(customerId, contactId);
	}

	async create(input: TCreateCustomerInput, actorUserId: string): Promise<TCustomerSelect> {
		await this.assertVillage(input.villageId);
		await this.assertCodeFree(input.code);
		try {
			return await this.customers.create({ ...input, createdBy: actorUserId });
		} catch (error) {
			// A concurrent insert won the race after the pre-check.
			if (isUniqueViolation(error)) throw new CustomerCodeTakenError(input.code);
			throw error;
		}
	}

	async update(id: string, patch: TUpdateCustomerInput): Promise<TCustomerSelect> {
		await this.requireCustomer(id);
		await this.assertVillage(patch.villageId);
		if (patch.code !== undefined) await this.assertCodeFree(patch.code, id);
		try {
			const updated = await this.customers.update(id, patch);
			if (!updated) throw new CustomerNotFoundError();
			return updated;
		} catch (error) {
			if (isUniqueViolation(error) && patch.code) throw new CustomerCodeTakenError(patch.code);
			throw error;
		}
	}

	async setActive(id: string, active: boolean): Promise<TCustomerSelect> {
		await this.requireCustomer(id);
		const updated = active
			? await this.customers.transitionStatus(id, 'inactive', 'active')
			: await this.customers.transitionStatus(id, 'active', 'inactive');
		if (!updated) throw new CustomerStatusUnchangedError(active ? 'active' : 'inactive');
		return updated;
	}

	async addContact(customerId: string, input: TCreateContactInput): Promise<TCustomerContactSelect> {
		await this.requireCustomer(customerId);
		return this.contacts.create(customerId, input);
	}

	async updateContact(
		customerId: string,
		contactId: string,
		patch: TUpdateContactInput,
	): Promise<TCustomerContactSelect> {
		await this.requireCustomer(customerId);
		const updated = await this.contacts.update(customerId, contactId, patch);
		if (!updated) throw new CustomerContactNotFoundError();
		return updated;
	}

	async removeContact(customerId: string, contactId: string): Promise<void> {
		await this.requireCustomer(customerId);
		if (!(await this.contacts.softDelete(customerId, contactId))) throw new CustomerContactNotFoundError();
	}
}
