import type {
	TCustomerCompanySelect,
	TCustomerSelect,
} from '@drizzle/schemas/customer.schema';
import { EXPORTED_USER_SERVICE_TOKEN } from '@app/user/constants/di';
import type { ExportedUserService } from '@app/user/services/exported-user.service';
import { inject, injectable } from 'tsyringe';

import { COMPANY_REPOSITORY_TOKEN, CUSTOMER_PERSON_REPOSITORY_TOKEN } from '../constants/di';
import type { ICompanyRepository } from '../contracts/customer.repository.interface';
import type { ICustomerPersonRepository } from '../contracts/customer.repository.interface';
import { CustomerNotFoundError } from '../errors/customer.errors';
import { customerListQuerySchema } from '../contracts/customer.contract';

/** The snapshot documents freeze onto a quotation/order/invoice. */
export type TCustomerSnapshot = {
	/** The company code, or the person code for an individual. */
	code: string;
	name: string;
	type: string;
	/** The company email, or the person's account email (ERP-0114). */
	email: string | null;
	/** E.164; also the WhatsApp number (the separate column is gone, ERP-0114). */
	phone: string | null;
	taxId: string | null;
	addressLine: string | null;
	postalCode: string | null;
};

/** A person with the email of their Better Auth account (ERP-0114). */
export type TCustomerContact = TCustomerSelect & { email: string | null };

/**
 * Repository-only facade over the customer master.
 *
 * @remarks
 * `sale`, `project`, `ticket`, `payment` and `inventory` resolve customer
 * references and build document snapshots here — never by importing this
 * module's schema. Repository-only (plus the identity facade, which depends
 * on nothing) so a consumer that itself depends on `sale` cannot create a
 * cycle. A person's email lives on their account and is read there.
 */
@injectable()
export class ExportedCustomerService {
	constructor(
		@inject(COMPANY_REPOSITORY_TOKEN)
		private readonly companies: ICompanyRepository,
		@inject(CUSTOMER_PERSON_REPOSITORY_TOKEN)
		private readonly people: ICustomerPersonRepository,
		@inject(EXPORTED_USER_SERVICE_TOKEN)
		private readonly users: Pick<ExportedUserService, 'findById'>,
	) {}

	/** The email of a person's account, or `null`. */
	async emailOf(person: Pick<TCustomerSelect, 'userId'>): Promise<string | null> {
		return person.userId ? ((await this.users.findById(person.userId))?.email ?? null) : null;
	}

	/** The live person by code, or `null` (opening AR import, ERP-0142). */
	findCustomerByCode(code: string): Promise<TCustomerSelect | null> {
		return this.people.findByCode(code);
	}

	/** The live person regardless of status, or an error. */
	async assertCustomer(id: string): Promise<TCustomerSelect> {
		const customer = await this.people.findById(id);
		if (!customer) throw new CustomerNotFoundError();
		return customer;
	}

	/** An active person, or `null` — for documents naming a person. */
	async getActiveCustomer(id: string): Promise<TCustomerContact | null> {
		const customer = await this.people.findById(id);
		if (customer?.status !== 'active') return null;
		return { ...customer, email: await this.emailOf(customer) };
	}

	/**
	 * Up to 20 active customer people matching `search` (code, name, phone),
	 * for pickers in other modules whose users lack `customer:read`
	 * (B-42: the finance role writing an invoice without a sales order).
	 */
	async activeCustomerOptions(search?: string): Promise<Array<{ id: string; code: string; name: string }>> {
		const query = customerListQuerySchema.parse({ page: 1, limit: 20, status: 'active', search: search || undefined });
		const page = await this.people.paginate({ ...query, page: 1, limit: 20 });
		return page.data.map((person) => ({ id: person.id, code: person.code, name: person.name }));
	}

	/** An active company, or `null` — for documents naming the entity. */
	async getActiveCompany(id: string): Promise<TCustomerCompanySelect | null> {
		const company = await this.companies.findById(id);
		return company?.status === 'active' ? company : null;
	}

	/** The live person behind a portal login, or `null`. */
	resolvePortalIdentity(userId: string): Promise<TCustomerSelect | null> {
		return this.people.findByUserId(userId);
	}

	/**
	 * Builds the snapshot documents print.
	 *
	 * @remarks
	 * Prefers the company when `companyId` is given; otherwise the person.
	 * Address columns live on the company row (billing/shipping addresses come
	 * from `customer.company_addresses` once the address repository is wired
	 * into snapshot building; the company row keeps a printed address line).
	 */
	async getSnapshot(subject: {
		customerId?: string | null;
		companyId?: string | null;
	}): Promise<TCustomerSnapshot | null> {
		if (subject.companyId) {
			const company = await this.companies.findById(subject.companyId);
			if (!company) return null;
			return {
				code: company.code,
				name: company.name,
				type: company.companyType,
				email: company.email,
				phone: company.phone,
				taxId: company.taxId,
				addressLine: null,
				postalCode: null,
			};
		}
		if (!subject.customerId) return null;
		const person = await this.people.findById(subject.customerId);
		if (!person) return null;
		return {
			code: person.code,
			name: person.name,
			type: person.customerType,
			email: await this.emailOf(person),
			phone: person.phone,
			taxId: null,
			addressLine: null,
			postalCode: null,
		};
	}
}
