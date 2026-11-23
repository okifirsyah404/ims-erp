import { EXPORTED_USER_SERVICE_TOKEN } from '@app/user/constants/di';
import type { ExportedUserService, TAccountSummary } from '@app/user/services/exported-user.service';
import type {
	PortalRole,
	TCustomerAddressSelect,
	TCustomerCompanyAddressSelect,
	TCustomerCompanySelect,
	TCustomerInsert,
	TCustomerSelect,
} from '@drizzle/schemas/customer.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';

import {
	COMPANY_ADDRESS_REPOSITORY_TOKEN,
	COMPANY_REPOSITORY_TOKEN,
	CUSTOMER_ACCOUNT_SERVICE_TOKEN,
	CUSTOMER_ADDRESS_REPOSITORY_TOKEN,
	CUSTOMER_NUMBERING_SERVICE_TOKEN,
	CUSTOMER_PERSON_REPOSITORY_TOKEN,
} from '../constants/di';
import type { CustomerNumberingService } from './customer-numbering.service';
import { defaultPassword, type CustomerAccountService, type TCustomerCredentials } from './customer-account.service';
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
	CustomerAccountMissingError,
	CustomerAddressNotFoundError,
	CustomerCodeTakenError,
	CustomerEmailVerifiedError,
	CustomerNotFoundError,
	CustomerOwnerInvalidError,
	CustomerStatusUnchangedError,
} from '../errors/customer.errors';

/** The short reference to a company or person other rows show. */
export type TCustomerRef = { id: string; code: string; name: string };

/** A company row as lists and the detail show it: with its owner (ERP-0114). */
export type TCustomerCompanyRow = TCustomerCompanySelect & { owner: TCustomerRef | null };

/** One company with its addresses and owner, the detail view. */
export type TCustomerCompanyView = TCustomerCompanyRow & {
	addresses: TCustomerCompanyAddressSelect[];
};

/**
 * A person as lists show them: the Better Auth account (email, username,
 * photo), the company and whether they own it (ERP-0114).
 */
export type TCustomerPersonRow = TCustomerSelect & {
	account: TAccountSummary | null;
	company: TCustomerRef | null;
	isOwner: boolean;
};

/** One person with their addresses, the detail view. */
export type TCustomerPersonView = TCustomerPersonRow & {
	addresses: TCustomerAddressSelect[];
};

/** A create returns the credentials once (shown to staff, emailed to the customer). */
export type TCustomerCreated = TCustomerPersonView & { credentials: TCustomerCredentials };

const ref = (row: { id: string; code: string; name: string } | null | undefined): TCustomerRef | null =>
	row ? { id: row.id, code: row.code, name: row.name } : null;

/**
 * Customer master-data use cases (company-wide, ADR-0011).
 *
 * @remarks
 * Permission checks live in the controller guards. Codes are unique across
 * live companies and live people together, because documents refer to either
 * by code.
 *
 * ERP-0114: every person has exactly one Better Auth account, created with
 * the person (generated username, default password, emailed credentials);
 * the email lives on that account. A company has at most one owner
 * (`companies.owner_customer_id`, one of its contacts) and any number of staff
 * contacts.
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
		@inject(CUSTOMER_ACCOUNT_SERVICE_TOKEN)
		private readonly accounts: Pick<
			CustomerAccountService,
			'assertEmailFree' | 'provision' | 'discard' | 'sendCredentials'
		>,
		@inject(EXPORTED_USER_SERVICE_TOKEN)
		private readonly users: Pick<
			ExportedUserService,
			'findById' | 'summaries' | 'findIdsByEmail' | 'updateProfile' | 'setAvatar' | 'clearAvatar'
		>,
	) {}

	/* ------------------------------ companies ------------------------------ */

	/** Fetches one filtered page of customer companies with their owners. */
	async listCompanies(request: TCompanyPaginationRequest): Promise<TPaginationResult<TCustomerCompanyRow>> {
		const page = await this.companies.paginate(request);
		const owners = await this.peopleById(page.data.map((row) => row.ownerCustomerId));
		return {
			...page,
			data: page.data.map((row) => ({ ...row, owner: ref(owners.get(row.ownerCustomerId ?? '')) })),
		};
	}

	async getCompany(id: string): Promise<TCustomerCompanyView> {
		const company = await this.companies.findById(id);
		if (!company) throw new CustomerNotFoundError();
		const owner = company.ownerCustomerId ? await this.people.findById(company.ownerCustomerId) : null;
		return { ...company, owner: ref(owner), addresses: await this.companyAddresses.listByCompany(id) };
	}

	/**
	 * Creates a customer company (a data record, no account); an empty code is
	 * generated (customer_company). The owner is set later, from its contacts.
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

	/** Updates a company; `ownerCustomerId` moves ownership to one of its contacts. */
	async updateCompany(id: string, patch: TUpdateCompanyInput): Promise<TCustomerCompanySelect> {
		const { ownerCustomerId, ...fields } = patch;
		if (fields.code !== undefined) await this.assertCodeFree(fields.code, id);
		const row = await this.companies.update(id, fields);
		if (!row) throw new CustomerNotFoundError();
		if (ownerCustomerId === undefined) return row;
		return this.setOwner(row, ownerCustomerId);
	}

	/**
	 * Moves ownership of a company to one of its contacts, or clears it
	 * (`null`). Used by the portal-account invite with role `owner`.
	 *
	 * @throws CustomerOwnerInvalidError When the person is not a contact of the company
	 */
	async transferOwnership(companyId: string, customerId: string | null): Promise<TCustomerCompanySelect> {
		const company = await this.companies.findById(companyId);
		if (!company) throw new CustomerNotFoundError();
		return this.setOwner(company, customerId);
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

	/**
	 * Fetches one filtered page of customer people with their accounts and
	 * companies. A search also matches account emails (through the user module).
	 */
	async listCustomers(request: TCustomerPaginationRequest): Promise<TPaginationResult<TCustomerPersonRow>> {
		const searchUserIds = request.search ? await this.users.findIdsByEmail(request.search) : undefined;
		const page = await this.people.paginate({ ...request, searchUserIds });
		return { ...page, data: await this.rows(page.data) };
	}

	async getCustomer(id: string): Promise<TCustomerPersonView> {
		const customer = await this.people.findById(id);
		if (!customer) throw new CustomerNotFoundError();
		return this.view(customer);
	}

	/**
	 * Creates a customer person with their Better Auth account; an empty code
	 * is generated (customer). `newCompany` creates the company too, with this
	 * person as its owner. Returns the credentials once.
	 *
	 * @remarks
	 * The account is created first and removed again when a later write
	 * fails (the repositories share no transaction); an inline company is
	 * soft-deleted the same way.
	 *
	 * @param organizationId - The caller's organization, for the {ORG} token
	 * @throws CustomerEmailTakenError When the email belongs to any account
	 */
	async createCustomer(
		input: TCreateCustomerInput,
		actorUserId: string,
		organizationId?: string | null,
	): Promise<TCustomerCreated> {
		if (input.companyId) await this.assertCompany(input.companyId);
		const code = input.code ?? (await this.numbering.next('customer', undefined, new Date(), organizationId));
		await this.assertCodeFree(code);
		const companyCode = input.newCompany
			? (input.newCompany.code ??
				(await this.numbering.next('customer_company', undefined, new Date(), organizationId)))
			: null;
		if (companyCode) {
			if (companyCode === code) throw new CustomerCodeTakenError(companyCode);
			await this.assertCodeFree(companyCode);
		}

		const { user, credentials } = await this.accounts.provision({ name: input.name, email: input.email });
		let inlineCompany: TCustomerCompanySelect | null = null;
		let person: TCustomerSelect;
		try {
			if (input.newCompany && companyCode) {
				inlineCompany = await this.companies.create({
					code: companyCode,
					name: input.newCompany.name,
					companyType: input.newCompany.companyType,
					status: 'active',
					createdBy: actorUserId,
				});
			}
			const companyId = inlineCompany?.id ?? input.companyId;
			const owner = Boolean(inlineCompany) || (Boolean(companyId) && input.isOwner);
			person = await this.people.create({
				code,
				companyId,
				name: input.name,
				position: input.position,
				phone: input.phone,
				notes: input.notes,
				customerType: companyId ? 'contact' : 'individual',
				status: 'active',
				userId: user.id,
				portalRole: this.roleFor(companyId, owner),
				portalStatus: 'active',
				portalInvitedBy: actorUserId,
				portalPasswordChangeRequired: true,
				createdBy: actorUserId,
			});
			if (companyId && owner) {
				const company = inlineCompany ?? (await this.companies.findById(companyId));
				if (company) await this.setOwner(company, person.id);
			}
		} catch (error) {
			await this.accounts.discard(user.id);
			if (inlineCompany) await this.companies.softDelete(inlineCompany.id);
			throw error;
		}

		await this.accounts.sendCredentials({ email: user.email, name: input.name, ...credentials });
		return { ...(await this.view(person)), credentials };
	}

	/**
	 * Updates a person. Name and email are written to the Better Auth account
	 * too; a verified email is locked. Moving a contact or clearing `isOwner`
	 * gives up ownership of the old company.
	 *
	 * @throws CustomerEmailVerifiedError When a verified email would change
	 */
	async updateCustomer(id: string, patch: TUpdateCustomerInput): Promise<TCustomerPersonView> {
		const current = await this.people.findById(id);
		if (!current) throw new CustomerNotFoundError();
		const { email, isOwner, ...fields } = patch;
		if (fields.companyId) await this.assertCompany(fields.companyId);
		if (fields.code !== undefined) await this.assertCodeFree(fields.code, id);

		const account = current.userId ? await this.users.findById(current.userId) : null;
		const newEmail = email !== undefined && email !== account?.email ? email : null;
		if (newEmail) {
			if (!account) throw new CustomerAccountMissingError();
			if (account.emailVerified) throw new CustomerEmailVerifiedError();
			await this.accounts.assertEmailFree(newEmail, account.id);
		}

		const companyId = fields.companyId === undefined ? current.companyId : fields.companyId;
		const movedCompany = companyId !== current.companyId;
		const oldCompany = current.companyId ? await this.companies.findById(current.companyId) : null;
		const wasOwner = oldCompany?.ownerCustomerId === id;
		const owner = companyId ? (isOwner ?? (wasOwner && !movedCompany)) : false;

		const write: Partial<TCustomerInsert> = { ...fields, companyId };
		if (fields.companyId !== undefined) write.customerType = companyId ? 'contact' : 'individual';
		if (current.userId) write.portalRole = this.roleFor(companyId, owner, current.portalRole as PortalRole | null);
		const row = await this.people.update(id, write);
		if (!row) throw new CustomerNotFoundError();

		// Ownership: release the old company, then claim the new one.
		if (oldCompany && wasOwner && (movedCompany || !owner)) {
			await this.companies.update(oldCompany.id, { ownerCustomerId: null });
		}
		if (companyId && owner && (movedCompany || !wasOwner)) {
			const company = await this.companies.findById(companyId);
			if (company) await this.setOwner(company, id);
		}

		const nameChanged = fields.name !== undefined && fields.name !== account?.name;
		if (account && (newEmail || nameChanged)) {
			await this.users.updateProfile(account.id, {
				...(newEmail ? { email: newEmail } : {}),
				...(nameChanged ? { name: fields.name } : {}),
			});
		}
		// An unverified account has never signed in, so its password is still
		// the default: the credentials go to the corrected address.
		if (newEmail && account?.username) {
			await this.accounts.sendCredentials({
				email: newEmail,
				name: fields.name ?? current.name,
				username: account.username,
				password: defaultPassword(account.username),
			});
		}
		return this.view(row);
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
	 * Stores a staff-uploaded photo on the person's account (`auth.users.image`).
	 *
	 * @returns The presigned URL of the new photo
	 * @throws UnsupportedImageError When the bytes cannot be decoded
	 */
	async setCustomerPhoto(id: string, bytes: Uint8Array): Promise<{ image: string }> {
		const userId = await this.accountOf(id);
		return { image: await this.users.setAvatar(userId, bytes) };
	}

	async clearCustomerPhoto(id: string): Promise<void> {
		await this.users.clearAvatar(await this.accountOf(id));
	}

	/**
	 * An active person, or `null` — for documents naming the person.
	 *
	 * @remarks
	 * Same answer as `ExportedCustomerService.getActiveCustomer`; kept here so
	 * the HTTP-side service exposes the identical read.
	 */
	async getActiveCustomer(id: string): Promise<(TCustomerSelect & { email: string | null }) | null> {
		const customer = await this.people.findById(id);
		if (customer?.status !== 'active') return null;
		const account = customer.userId ? await this.users.findById(customer.userId) : null;
		return { ...customer, email: account?.email ?? null };
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

	/**
	 * Portal role of a person: an individual owns their own account; a
	 * contact is the owner or staff. A staff role (approver/finance) is kept.
	 */
	private roleFor(companyId: string | null | undefined, owner: boolean, current: PortalRole | null = null): PortalRole {
		if (!companyId || owner) return 'owner';
		return current && current !== 'owner' ? current : 'viewer';
	}

	/**
	 * Moves ownership of `company` to `customerId` (one of its contacts) or
	 * clears it. The previous owner becomes a viewer; the new one an owner.
	 *
	 * @throws CustomerOwnerInvalidError When the person is not a live contact of the company
	 */
	private async setOwner(company: TCustomerCompanySelect, customerId: string | null): Promise<TCustomerCompanySelect> {
		if (company.ownerCustomerId === customerId) return company;
		if (customerId) {
			const person = await this.people.findById(customerId);
			if (!person || person.companyId !== company.id) throw new CustomerOwnerInvalidError();
		}
		if (company.ownerCustomerId) {
			const previous = await this.people.findById(company.ownerCustomerId);
			if (previous?.portalRole === 'owner') await this.people.update(previous.id, { portalRole: 'viewer' });
		}
		const updated = await this.companies.update(company.id, { ownerCustomerId: customerId });
		if (!updated) throw new CustomerNotFoundError();
		if (customerId) await this.people.update(customerId, { portalRole: 'owner' });
		return updated;
	}

	private async accountOf(id: string): Promise<string> {
		const person = await this.people.findById(id);
		if (!person) throw new CustomerNotFoundError();
		if (!person.userId) throw new CustomerAccountMissingError();
		return person.userId;
	}

	/** Live people by id (missing ids skipped). */
	private async peopleById(ids: (string | null)[]): Promise<Map<string, TCustomerSelect>> {
		const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
		const rows = await Promise.all(unique.map((id) => this.people.findById(id)));
		return new Map(rows.filter((row): row is TCustomerSelect => Boolean(row)).map((row) => [row.id, row]));
	}

	/** Adds account, company and ownership to person rows (one account query). */
	private async rows(people: TCustomerSelect[]): Promise<TCustomerPersonRow[]> {
		const accounts = await this.users.summaries(people.map((person) => person.userId ?? ''));
		const companyIds = [
			...new Set(people.map((person) => person.companyId).filter((id): id is string => Boolean(id))),
		];
		const companies = new Map(
			(await Promise.all(companyIds.map((id) => this.companies.findById(id))))
				.filter((row): row is TCustomerCompanySelect => Boolean(row))
				.map((row) => [row.id, row]),
		);
		return people.map((person) => {
			const company = person.companyId ? companies.get(person.companyId) : undefined;
			return {
				...person,
				account: person.userId ? (accounts.get(person.userId) ?? null) : null,
				company: ref(company),
				isOwner: company ? company.ownerCustomerId === person.id : !person.companyId,
			};
		});
	}

	private async view(person: TCustomerSelect): Promise<TCustomerPersonView> {
		const [row] = await this.rows([person]);
		return { ...row!, addresses: await this.addresses.listByCustomer(person.id) };
	}
}
