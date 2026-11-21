import type {
	TCustomerAddressSelect,
	TCustomerCompanyAddressSelect,
	TCustomerCompanySelect,
	TCustomerSelect,
} from '@drizzle/schemas/customer.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';

import {
	COMPANY_ADDRESS_REPOSITORY_TOKEN,
	COMPANY_REPOSITORY_TOKEN,
	CUSTOMER_ADDRESS_REPOSITORY_TOKEN,
	CUSTOMER_NUMBERING_SERVICE_TOKEN,
	CUSTOMER_PERSON_REPOSITORY_TOKEN,
} from '../constants/di';
import type { CustomerNumberingService } from './customer-numbering.service';
import type {
	TCompanyAddressInput,
	TCreateCompanyInput,
	TCreateCustomerInput,
	TCustomerAddressInput,
	TUpdateCompanyAddressInput,
	TUpdateCompanyInput,
	TUpdateCustomerAddressInput,
	TUpdateCustomerInput,
} from '../contracts/customer.contract';
import type {
	ICompanyAddressRepository,
	ICompanyRepository,
	ICustomerAddressRepository,
	ICustomerPersonRepository,
	TCompanyPaginationRequest,
	TCustomerPaginationRequest,
} from '../contracts/customer.repository.interface';
import {
	CustomerAddressNotFoundError,
	CustomerCodeTakenError,
	CustomerNotFoundError,
	CustomerStatusUnchangedError,
} from '../errors/customer.errors';

/** One company with its addresses, the detail view. */
export type TCustomerCompanyView = TCustomerCompanySelect & {
	addresses: TCustomerCompanyAddressSelect[];
};

/** One person with their addresses, the detail view. */
export type TCustomerPersonView = TCustomerSelect & {
	addresses: TCustomerAddressSelect[];
};

/**
 * Customer master-data use cases (company-wide, ADR-0011).
 *
 * @remarks
 * Permission checks live in the controller guards. Codes are unique across
 * live companies and live people together, because documents refer to either
 * by code.
 */
@injectable()
export class CustomerService {
	constructor(
		@inject(COMPANY_REPOSITORY_TOKEN)
		private readonly companies: ICompanyRepository,
		@inject(CUSTOMER_PERSON_REPOSITORY_TOKEN)
		private readonly people: ICustomerPersonRepository,
		@inject(COMPANY_ADDRESS_REPOSITORY_TOKEN)
		private readonly companyAddresses: ICompanyAddressRepository,
		@inject(CUSTOMER_ADDRESS_REPOSITORY_TOKEN)
		private readonly addresses: ICustomerAddressRepository,
		@inject(CUSTOMER_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<CustomerNumberingService, 'next'>,
	) {}

	/* ------------------------------ companies ------------------------------ */

	/** Fetches one filtered page of customer companies. */
	async listCompanies(request: TCompanyPaginationRequest): Promise<TPaginationResult<TCustomerCompanySelect>> {
		return this.companies.paginate(request);
	}

	async getCompany(id: string): Promise<TCustomerCompanyView> {
		const company = await this.companies.findById(id);
		if (!company) throw new CustomerNotFoundError();
		return { ...company, addresses: await this.companyAddresses.listByCompany(id) };
	}

	/**
	 * Creates a customer company; an empty code is generated (customer_company).
	 *
	 * @param organizationId - The caller's organization, for the {ORG} token
	 */
	async createCompany(
		input: TCreateCompanyInput,
		actorUserId: string,
		organizationId?: string | null,
	): Promise<TCustomerCompanySelect> {
		const code = input.code ?? (await this.numbering.next('customer_company', undefined, new Date(), organizationId));
		await this.assertCodeFree(code);
		return this.companies.create({ ...input, code, createdBy: actorUserId });
	}

	async updateCompany(id: string, patch: TUpdateCompanyInput): Promise<TCustomerCompanySelect> {
		if (patch.code !== undefined) await this.assertCodeFree(patch.code, id);
		const row = await this.companies.update(id, patch);
		if (!row) throw new CustomerNotFoundError();
		return row;
	}

	async setCompanyActive(id: string, active: boolean): Promise<TCustomerCompanySelect> {
		const current = await this.companies.findById(id);
		if (!current) throw new CustomerNotFoundError();
		const target = active ? 'active' : 'inactive';
		if (current.status === target) throw new CustomerStatusUnchangedError(active);
		const updated = await this.companies.transitionStatus(
			id,
			current.status as 'active' | 'inactive',
			active ? 'active' : 'inactive',
		);
		if (!updated) throw new CustomerStatusUnchangedError(active);
		return updated;
	}

	/* ------------------------------- people -------------------------------- */

	/** Fetches one filtered page of customer people. */
	async listCustomers(request: TCustomerPaginationRequest): Promise<TPaginationResult<TCustomerSelect>> {
		return this.people.paginate(request);
	}

	async getCustomer(id: string): Promise<TCustomerPersonView> {
		const customer = await this.people.findById(id);
		if (!customer) throw new CustomerNotFoundError();
		return { ...customer, addresses: await this.addresses.listByCustomer(id) };
	}

	/**
	 * Creates a customer person; an empty code is generated (customer).
	 *
	 * @param organizationId - The caller's organization, for the {ORG} token
	 */
	async createCustomer(
		input: TCreateCustomerInput,
		actorUserId: string,
		organizationId?: string | null,
	): Promise<TCustomerSelect> {
		if (input.companyId) await this.assertCompany(input.companyId);
		const code = input.code ?? (await this.numbering.next('customer', undefined, new Date(), organizationId));
		await this.assertCodeFree(code);
		return this.people.create({ ...input, code, createdBy: actorUserId });
	}

	async updateCustomer(id: string, patch: TUpdateCustomerInput): Promise<TCustomerSelect> {
		if (patch.companyId) await this.assertCompany(patch.companyId);
		if (patch.code !== undefined) await this.assertCodeFree(patch.code, id);
		const row = await this.people.update(id, patch);
		if (!row) throw new CustomerNotFoundError();
		return row;
	}

	async setCustomerActive(id: string, active: boolean): Promise<TCustomerSelect> {
		const current = await this.people.findById(id);
		if (!current) throw new CustomerNotFoundError();
		const target = active ? 'active' : 'inactive';
		if (current.status === target) throw new CustomerStatusUnchangedError(active);
		const updated = await this.people.transitionStatus(
			id,
			current.status as 'active' | 'inactive',
			active ? 'active' : 'inactive',
		);
		if (!updated) throw new CustomerStatusUnchangedError(active);
		return updated;
	}

	/**
	 * An active person, or `null` — for documents naming the person.
	 *
	 * @remarks
	 * Same answer as `ExportedCustomerService.getActiveCustomer`; kept here so
	 * the HTTP-side service exposes the identical read.
	 */
	async getActiveCustomer(id: string): Promise<TCustomerSelect | null> {
		const customer = await this.people.findById(id);
		return customer?.status === 'active' ? customer : null;
	}

	/* ------------------------------ addresses ------------------------------ */

	async addCompanyAddress(companyId: string, data: TCompanyAddressInput) {
		await this.assertCompany(companyId);
		return this.companyAddresses.create(companyId, data);
	}

	async updateCompanyAddress(companyId: string, addressId: string, patch: TUpdateCompanyAddressInput) {
		const row = await this.companyAddresses.update(companyId, addressId, patch);
		if (!row) throw new CustomerAddressNotFoundError();
		return row;
	}

	async removeCompanyAddress(companyId: string, addressId: string): Promise<void> {
		if (!(await this.companyAddresses.softDelete(companyId, addressId))) {
			throw new CustomerAddressNotFoundError();
		}
	}

	async addCustomerAddress(customerId: string, data: TCustomerAddressInput) {
		if (!(await this.people.findById(customerId))) throw new CustomerNotFoundError();
		return this.addresses.create(customerId, data);
	}

	async updateCustomerAddress(customerId: string, addressId: string, patch: TUpdateCustomerAddressInput) {
		const row = await this.addresses.update(customerId, addressId, patch);
		if (!row) throw new CustomerAddressNotFoundError();
		return row;
	}

	async removeCustomerAddress(customerId: string, addressId: string): Promise<void> {
		if (!(await this.addresses.softDelete(customerId, addressId))) {
			throw new CustomerAddressNotFoundError();
		}
	}

	/* ------------------------------ internals ------------------------------ */

	private async assertCompany(id: string): Promise<void> {
		if (!(await this.companies.findById(id))) throw new CustomerNotFoundError();
	}

	/** Throws when a live company or person already holds `code`, except `exceptId`. */
	private async assertCodeFree(code: string, exceptId?: string): Promise<void> {
		const company = await this.companies.findByCode(code);
		const person = await this.people.findByCode(code);
		if ((company && company.id !== exceptId) || (person && person.id !== exceptId)) {
			throw new CustomerCodeTakenError(code);
		}
	}
}
