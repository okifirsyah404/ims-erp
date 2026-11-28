/**
 * Customer module unit tests.
 *
 * @remarks
 * Repository doubles only, no database. Covers code uniqueness across live
 * companies and people, activation guards, company existence checks, the
 * `ExportedCustomerService` read facade, and ERP-0114: one Better Auth
 * account per person (username, default password, credentials email), the
 * one-owner company model and the verified-email lock.
 */
import { describe, expect, test } from 'bun:test';
import type {
	TCustomerCompanySelect,
	TCustomerSelect,
} from '@drizzle/schemas/customer.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type {
	ICompanyAddressRepository,
	ICompanyRepository,
	ICustomerAddressRepository,
	ICustomerPersonRepository,
	TCompanyPaginationRequest,
	TCustomerPaginationRequest,
	TNewCompany,
	TNewCustomer,
} from '../../src/app/customer/contracts/customer.repository.interface';
import {
	CustomerCodeTakenError,
	CustomerEmailTakenError,
	CustomerEmailVerifiedError,
	CustomerNotFoundError,
	CustomerOwnerInvalidError,
	CustomerStatusUnchangedError,
} from '../../src/app/customer/errors/customer.errors';
import {
	CustomerAccountService,
	defaultPassword,
	usernameBase,
	usernameCandidate,
} from '../../src/app/customer/services/customer-account.service';
import { CustomerService } from '../../src/app/customer/services/customer.service';
import { ExportedCustomerService } from '../../src/app/customer/services/exported-customer.service';
import type { TAuthUser } from '../../src/app/user/contracts/user-account.gateway.interface';

/** Shared in-memory store: companies and people live in one code namespace. */
class FakeCompanies implements ICompanyRepository {
	rows: TCustomerCompanySelect[] = [];
	private seq = 0;

	async paginate(request: TCompanyPaginationRequest) {
		const rows = this.rows.filter((row) => row.deletedAt === null);
		return {
			meta: {
				page: request.page,
				limit: request.limit,
				total: rows.length,
				totalPages: Math.ceil(rows.length / request.limit),
			},
			data: rows,
		};
	}

	async findById(id: string) {
		return this.rows.find((row) => row.id === id && row.deletedAt === null) ?? null;
	}

	async findByCode(code: string) {
		return this.rows.find((row) => row.code === code && row.deletedAt === null) ?? null;
	}

	async create(data: TNewCompany) {
		this.seq += 1;
		const now = new Date();
		const row = {
			ownerCustomerId: null,
			...data,
			id: `co${this.seq}`,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
		} as TCustomerCompanySelect;
		this.rows.push(row);
		return row;
	}

	async update(id: string, patch: Partial<TCustomerCompanySelect>) {
		const row = await this.findById(id);
		if (!row) return null;
		Object.assign(row, patch);
		return row;
	}

	async softDelete(id: string) {
		const row = await this.findById(id);
		if (row) row.deletedAt = new Date();
	}

	async transitionStatus(id: string, from: 'active' | 'inactive', to: 'active' | 'inactive') {
		const row = await this.findById(id);
		if (!row || row.status !== from) return null;
		row.status = to;
		return row;
	}
}

class FakePeople implements ICustomerPersonRepository {
	rows: TCustomerSelect[] = [];
	private seq = 0;
	/** Set to make the next `create` fail (compensation tests). */
	failNextCreate = false;

	/* Portal logins are covered by portal-account.test.ts; unused here. */
	async listPortalAccounts() {
		return [];
	}
	async grantPortalAccess() {
		return null;
	}
	async revokePortalAccess() {
		return null;
	}
	async touchPortalLogin() {}

	async paginate(request: TCustomerPaginationRequest): Promise<TPaginationResult<TCustomerSelect>> {
		const term = request.search?.toLowerCase();
		const rows = this.rows.filter(
			(row) =>
				row.deletedAt === null &&
				(!term || row.name.toLowerCase().includes(term) || request.searchUserIds?.includes(row.userId ?? '')),
		);
		return {
			meta: {
				page: request.page,
				limit: request.limit,
				total: rows.length,
				totalPages: Math.ceil(rows.length / request.limit),
			},
			data: rows,
		};
	}

	async findById(id: string) {
		return this.rows.find((row) => row.id === id && row.deletedAt === null) ?? null;
	}

	async findByCode(code: string) {
		return this.rows.find((row) => row.code === code && row.deletedAt === null) ?? null;
	}

	async findByUserId(userId: string) {
		return this.rows.find((row) => row.userId === userId && row.deletedAt === null) ?? null;
	}

	async create(data: TNewCustomer) {
		if (this.failNextCreate) {
			this.failNextCreate = false;
			throw new Error('insert failed');
		}
		this.seq += 1;
		const now = new Date();
		const row = { ...data, id: `cu${this.seq}`, createdAt: now, updatedAt: now, deletedAt: null } as TCustomerSelect;
		this.rows.push(row);
		return row;
	}

	async update(id: string, patch: Partial<TCustomerSelect>) {
		const row = await this.findById(id);
		if (!row) return null;
		Object.assign(row, patch);
		return row;
	}

	async clearPasswordChangeRequired(id: string) {
		const row = await this.findById(id);
		if (row) row.portalPasswordChangeRequired = false;
	}

	async transitionStatus(id: string, from: 'active' | 'inactive', to: 'active' | 'inactive') {
		const row = await this.findById(id);
		if (!row || row.status !== from) return null;
		row.status = to;
		return row;
	}
}

type TFakeUser = TAuthUser & { password?: string; roles: string[] };

/** Identity double: users, usernames, avatars (no Better Auth). */
class FakeUsers {
	users: TFakeUser[] = [];
	deleted: string[] = [];
	private seq = 0;

	async findByEmail(email: string) {
		return this.users.find((user) => user.email === email) ?? null;
	}
	async findById(id: string) {
		return this.users.find((user) => user.id === id) ?? null;
	}
	async isUsernameTaken(username: string) {
		return this.users.some((user) => user.username === username);
	}
	async createCustomerAccount(input: { name: string; email: string; username: string; password: string }) {
		this.seq += 1;
		const user: TFakeUser = {
			id: `u${this.seq}`,
			name: input.name,
			email: input.email,
			emailVerified: false,
			username: input.username,
			image: null,
			password: input.password,
			roles: [],
		};
		this.users.push(user);
		return user;
	}
	async grantCustomerRole(id: string) {
		(await this.findById(id))?.roles.push('customer');
	}
	async deleteUnusedUser(id: string) {
		this.deleted.push(id);
		this.users = this.users.filter((user) => user.id !== id);
	}
	async summaries(ids: string[]) {
		return new Map(
			this.users
				.filter((user) => ids.includes(user.id))
				.map((user) => [
					user.id,
					{
						id: user.id,
						name: user.name,
						email: user.email,
						emailVerified: user.emailVerified,
						username: user.username ?? null,
						image: null,
					},
				]),
		);
	}
	async findIdsByEmail(term: string) {
		return this.users.filter((user) => user.email.includes(term)).map((user) => user.id);
	}
	async updateProfile(id: string, patch: { name?: string; email?: string }) {
		const user = await this.findById(id);
		if (user) Object.assign(user, patch);
	}
	async setAvatar(id: string) {
		return `https://s3.test/${id}`;
	}
	async clearAvatar() {}
}

class FakeMailer {
	sent: { to: string; username: string; password: string }[] = [];
	async sendCredentials(input: { to: string; username: string; password: string }) {
		this.sent.push({ to: input.to, username: input.username, password: input.password });
	}
}

/** Address ports: person views list addresses; nothing else is exercised. */
const unusedCompanyAddresses = {} as ICompanyAddressRepository;
const unusedCustomerAddresses = { listByCustomer: async () => [] } as unknown as ICustomerAddressRepository;

const ACTOR = 'user-1';

function companyInput(code: string) {
	return {
		code,
		companyType: 'company' as const,
		name: `PT ${code}`,
		legalName: null,
		taxId: null,
		email: null,
		phone: null,
		website: null,
		status: 'active' as const,
		notes: null,
	};
}

function personInput(code: string | undefined, companyId: string | null = null, email?: string) {
	return {
		code,
		companyId,
		newCompany: null,
		isOwner: false,
		name: `Person ${code ?? 'X'}`,
		position: null,
		email: email ?? `${(code ?? 'x').toLowerCase()}@example.com`,
		phone: null,
		notes: null,
	};
}

/** Numbering double: one counter per code type, records the organization. */
class FakeCustomerNumbering {
	calls: { codeType: string; organizationId: string | null | undefined }[] = [];
	private readonly counters = new Map<string, number>();

	async next(codeType: string, _tx?: unknown, _date?: Date, organizationId?: string | null) {
		this.calls.push({ codeType, organizationId });
		const seq = (this.counters.get(codeType) ?? 0) + 1;
		this.counters.set(codeType, seq);
		const type = codeType === 'customer' ? 'CUS' : 'CMP';
		return `${type}-${String(seq).padStart(5, '0')}`;
	}
}

function setup() {
	const companies = new FakeCompanies();
	const people = new FakePeople();
	const numbering = new FakeCustomerNumbering();
	const users = new FakeUsers();
	const mailer = new FakeMailer();
	const accounts = new CustomerAccountService(users as never, mailer);
	accounts.portalUrl = 'https://portal.test';
	const service = new CustomerService(
		companies,
		people,
		unusedCompanyAddresses,
		unusedCustomerAddresses,
		numbering as never,
		accounts,
		users as never,
	);
	const exported = new ExportedCustomerService(companies, people, users as never);
	return { companies, people, numbering, users, mailer, service, exported };
}

describe('CustomerService: generated codes', () => {
	test('an omitted company code is generated as customer_company', async () => {
		const { service, numbering } = setup();
		const company = await service.createCompany({ ...companyInput('X'), code: undefined }, ACTOR, 'org-1');
		expect(company.code).toBe('CMP-00001');
		expect(numbering.calls).toEqual([{ codeType: 'customer_company', organizationId: 'org-1' }]);
	});

	test('an omitted person code is generated as customer', async () => {
		const { service } = setup();
		const person = await service.createCustomer(personInput(undefined), ACTOR, 'org-1');
		expect(person.code).toBe('CUS-00001');
	});

	test('a typed code is kept and nothing is allocated', async () => {
		const { service, numbering } = setup();
		const company = await service.createCompany(companyInput('ACME'), ACTOR, 'org-1');
		expect(company.code).toBe('ACME');
		expect(numbering.calls).toHaveLength(0);
	});
});

describe('CustomerService: code uniqueness', () => {
	test('rejects a company code already used by a live company', async () => {
		const { service } = setup();
		await service.createCompany(companyInput('ACME'), ACTOR);
		await expect(service.createCompany(companyInput('ACME'), ACTOR)).rejects.toBeInstanceOf(
			CustomerCodeTakenError,
		);
	});

	test('rejects a person code already used by a company (one namespace)', async () => {
		const { service } = setup();
		await service.createCompany(companyInput('SHARED'), ACTOR);
		await expect(service.createCustomer(personInput('SHARED'), ACTOR)).rejects.toBeInstanceOf(
			CustomerCodeTakenError,
		);
	});

	test('allows a code freed by an archived row', async () => {
		const { service, companies } = setup();
		const created = await service.createCompany(companyInput('OLD'), ACTOR);
		companies.rows[0]!.deletedAt = new Date();
		expect(created.id).toBeDefined();
		await expect(service.createCompany(companyInput('OLD'), ACTOR)).resolves.toBeDefined();
	});
});

describe('CustomerService: parent checks and activation', () => {
	test('createCustomer rejects an unknown companyId', async () => {
		const { service } = setup();
		await expect(
			service.createCustomer(personInput('P1', 'missing-company'), ACTOR),
		).rejects.toBeInstanceOf(CustomerNotFoundError);
	});

	test('deactivating an inactive company is refused', async () => {
		const { service } = setup();
		const company = await service.createCompany(companyInput('DEACT'), ACTOR);
		await service.setCompanyActive(company.id, false);
		await expect(service.setCompanyActive(company.id, false)).rejects.toBeInstanceOf(
			CustomerStatusUnchangedError,
		);
	});

	test('reactivating a person moves inactive to active', async () => {
		const { service } = setup();
		const person = await service.createCustomer(personInput('P2'), ACTOR);
		await service.setCustomerActive(person.id, false);
		const reactivated = await service.setCustomerActive(person.id, true);
		expect(reactivated.status).toBe('active');
	});
});

describe('ExportedCustomerService: read facade', () => {
	test('getSnapshot returns the company when companyId is given', async () => {
		const { service, exported } = setup();
		const company = await service.createCompany(companyInput('SNAP'), ACTOR);
		const snapshot = await exported.getSnapshot({ companyId: company.id });
		expect(snapshot?.code).toBe('SNAP');
		expect(snapshot?.type).toBe('company');
	});

	test('getSnapshot of a person reads the email from the account', async () => {
		const { service, exported } = setup();
		const person = await service.createCustomer(personInput('SNP'), ACTOR);
		expect((await exported.getSnapshot({ customerId: person.id }))?.email).toBe('snp@example.com');
	});

	test('getSnapshot returns null for an unknown id', async () => {
		const { exported } = setup();
		expect(await exported.getSnapshot({ companyId: 'nope' })).toBeNull();
		expect(await exported.getSnapshot({})).toBeNull();
	});

	test('getActiveCustomer hides an inactive person and carries the account email', async () => {
		const { service, exported } = setup();
		const person = await service.createCustomer(personInput('P3'), ACTOR);
		expect((await exported.getActiveCustomer(person.id))?.email).toBe('p3@example.com');
		await service.setCustomerActive(person.id, false);
		expect(await exported.getActiveCustomer(person.id)).toBeNull();
	});
});

describe('CustomerAccountService: username and password (ERP-0114)', () => {
	test('the base is lower-case ASCII with underscores, at most 23 characters', () => {
		expect(usernameBase('Budi Santoso')).toBe('budi_santoso');
		expect(usernameBase('  Dr. Siti Nurhaliza, S.E. ')).toBe('dr_siti_nurhaliza_s_e');
		expect(usernameBase('Ána Çelik')).toBe('ana_celik');
		expect(usernameBase('Bartholomew Alexander Wiryawan').length).toBeLessThanOrEqual(23);
		expect(usernameBase('Al')).toBe('cust_al');
		expect(usernameBase('李')).toBe('cust');
	});

	test('the username always carries _ and the last 6 digits of the ms timestamp', () => {
		expect(usernameCandidate('budi_santoso', 1_764_000_482_913)).toBe('budi_santoso_482913');
		expect(usernameCandidate('x'.repeat(23), 1).length).toBeLessThanOrEqual(30);
	});

	test('the default password is the username followed by 12345678', () => {
		expect(defaultPassword('budi_santoso_482913')).toBe('budi_santoso_48291312345678');
	});
});

describe('CustomerService: account per person (ERP-0114)', () => {
	test('a create makes one account, returns and emails the credentials, flags the password', async () => {
		const { service, users, mailer, people } = setup();
		const created = await service.createCustomer(personInput('P10'), ACTOR);
		expect(users.users).toHaveLength(1);
		const user = users.users[0]!;
		expect(created.userId).toBe(user.id);
		expect(created.credentials.username).toMatch(/^person_p10_\d{6}$/);
		expect(created.credentials.password).toBe(`${created.credentials.username}12345678`);
		expect(user.password).toBe(created.credentials.password);
		expect(user.emailVerified).toBe(false);
		expect(user.roles).toEqual(['customer']);
		expect(mailer.sent).toEqual([{ to: 'p10@example.com', ...created.credentials }]);
		expect(people.rows[0]!.portalPasswordChangeRequired).toBe(true);
		expect(created.account?.email).toBe('p10@example.com');
		expect(created.portalRole).toBe('owner');
	});

	test('an email that belongs to any account is refused before anything is written', async () => {
		const { service, people } = setup();
		await service.createCustomer(personInput('P11', null, 'taken@example.com'), ACTOR);
		await expect(
			service.createCustomer(personInput('P12', null, 'taken@example.com'), ACTOR),
		).rejects.toBeInstanceOf(CustomerEmailTakenError);
		expect(people.rows).toHaveLength(1);
	});

	test('a failed person insert removes the new account and rolls back the inline company (P7-5)', async () => {
		const { companies, people, numbering, users, service: _plain } = setup();
		// A runner that behaves like a database transaction for the fakes:
		// rows written inside it disappear when the work throws.
		const runner = {
			run: async <T,>(work: (tx: never) => Promise<T>): Promise<T> => {
				const before = companies.rows.length;
				try {
					return await work({} as never);
				} catch (error) {
					companies.rows.length = before;
					throw error;
				}
			},
		};
		const service = new CustomerService(
			companies,
			people,
			unusedCompanyAddresses,
			unusedCustomerAddresses,
			numbering as never,
			_plain['accounts' as never],
			users as never,
			runner,
		);
		people.failNextCreate = true;
		await expect(
			service.createCustomer(
				{ ...personInput('P13'), newCompany: { code: 'NEWCO', name: 'PT New', companyType: 'company' } },
				ACTOR,
			),
		).rejects.toThrow('insert failed');
		expect(users.users).toHaveLength(0);
		expect(users.deleted).toHaveLength(1);
		expect(companies.rows).toHaveLength(0);
	});

	test('an unverified email can be corrected and the credentials are re-sent', async () => {
		const { service, users, mailer } = setup();
		const created = await service.createCustomer(personInput('P14'), ACTOR);
		await service.updateCustomer(created.id, { email: 'fixed@example.com' });
		expect(users.users[0]!.email).toBe('fixed@example.com');
		expect(mailer.sent[mailer.sent.length - 1]).toEqual({ to: 'fixed@example.com', ...created.credentials });
	});

	test('a verified email is locked', async () => {
		const { service, users } = setup();
		const created = await service.createCustomer(personInput('P15'), ACTOR);
		users.users[0]!.emailVerified = true;
		await expect(service.updateCustomer(created.id, { email: 'other@example.com' })).rejects.toBeInstanceOf(
			CustomerEmailVerifiedError,
		);
		// Sending the same email again is not a change.
		await expect(service.updateCustomer(created.id, { email: 'p15@example.com' })).resolves.toBeDefined();
	});

	test('a name change is written to the account too', async () => {
		const { service, users } = setup();
		const created = await service.createCustomer(personInput('P17'), ACTOR);
		await service.updateCustomer(created.id, { name: 'Renamed' });
		expect(users.users[0]!.name).toBe('Renamed');
	});

	test('a search also matches account emails', async () => {
		const { service } = setup();
		await service.createCustomer(personInput('P16', null, 'findme@example.com'), ACTOR);
		const page = await service.listCustomers({ page: 1, limit: 20, search: 'findme', sort: 'name', order: 'asc' });
		expect(page.data[0]?.account?.email).toBe('findme@example.com');
	});
});

describe('CustomerService: one owner per company (ERP-0114)', () => {
	test('an inline company is created with the new person as its owner', async () => {
		const { service, companies } = setup();
		const created = await service.createCustomer(
			{ ...personInput('P20'), newCompany: { code: 'INL', name: 'PT Inline', companyType: 'company' } },
			ACTOR,
		);
		expect(created.customerType).toBe('contact');
		expect(created.isOwner).toBe(true);
		expect(created.portalRole).toBe('owner');
		expect(companies.rows[0]!.ownerCustomerId).toBe(created.id);
	});

	test('other contacts are staff (viewer); ownership moves and demotes the previous owner', async () => {
		const { service, companies, people } = setup();
		const company = await service.createCompany(companyInput('OWN'), ACTOR);
		const first = await service.createCustomer({ ...personInput('P21', company.id), isOwner: true }, ACTOR);
		const second = await service.createCustomer(personInput('P22', company.id), ACTOR);
		expect(second.portalRole).toBe('viewer');
		expect(second.isOwner).toBe(false);

		await service.updateCompany(company.id, { ownerCustomerId: second.id });
		expect(companies.rows[0]!.ownerCustomerId).toBe(second.id);
		expect(people.rows.find((row) => row.id === first.id)!.portalRole).toBe('viewer');
		expect(people.rows.find((row) => row.id === second.id)!.portalRole).toBe('owner');
	});

	test('the owner must be a contact of the company', async () => {
		const { service } = setup();
		const company = await service.createCompany(companyInput('OWN2'), ACTOR);
		const outsider = await service.createCustomer(personInput('P23'), ACTOR);
		await expect(
			service.updateCompany(company.id, { ownerCustomerId: outsider.id }),
		).rejects.toBeInstanceOf(CustomerOwnerInvalidError);
	});

	test('moving the owner to another company releases the old company', async () => {
		const { service, companies } = setup();
		const a = await service.createCompany(companyInput('CA'), ACTOR);
		const b = await service.createCompany(companyInput('CB'), ACTOR);
		const person = await service.createCustomer({ ...personInput('P24', a.id), isOwner: true }, ACTOR);
		const moved = await service.updateCustomer(person.id, { companyId: b.id });
		expect(companies.rows.find((row) => row.id === a.id)!.ownerCustomerId).toBeNull();
		expect(moved.isOwner).toBe(false);
		expect(moved.portalRole).toBe('viewer');
	});
});
