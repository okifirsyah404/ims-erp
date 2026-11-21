/**
 * Customer module unit tests.
 *
 * @remarks
 * Repository doubles only, no database. Covers code uniqueness across live
 * companies and people, activation guards, company existence checks, and the
 * `ExportedCustomerService` read facade.
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
	CustomerNotFoundError,
	CustomerStatusUnchangedError,
} from '../../src/app/customer/errors/customer.errors';
import { CustomerService } from '../../src/app/customer/services/customer.service';
import { ExportedCustomerService } from '../../src/app/customer/services/exported-customer.service';

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
		const row = { ...data, id: `co${this.seq}`, createdAt: now, updatedAt: now, deletedAt: null } as TCustomerCompanySelect;
		this.rows.push(row);
		return row;
	}

	async update(id: string, patch: Partial<TCustomerCompanySelect>) {
		const row = await this.findById(id);
		if (!row) return null;
		Object.assign(row, patch);
		return row;
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

	async findByUserId(userId: string) {
		return this.rows.find((row) => row.userId === userId && row.deletedAt === null) ?? null;
	}

	async create(data: TNewCustomer) {
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

	async clearPrimary(companyId: string) {
		for (const row of this.rows) {
			if (row.companyId === companyId) row.isPrimary = false;
		}
	}

	async transitionStatus(id: string, from: 'active' | 'inactive', to: 'active' | 'inactive') {
		const row = await this.findById(id);
		if (!row || row.status !== from) return null;
		row.status = to;
		return row;
	}
}

/** Address ports are not exercised by these tests. */
const unusedCompanyAddresses = {} as ICompanyAddressRepository;
const unusedCustomerAddresses = {} as ICustomerAddressRepository;

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
		whatsapp: null,
		website: null,
		status: 'active' as const,
		notes: null,
	};
}

function personInput(code: string, companyId: string | null = null) {
	return {
		code,
		companyId,
		customerType: companyId ? ('contact' as const) : ('individual' as const),
		name: `Person ${code}`,
		position: null,
		email: null,
		phone: null,
		whatsapp: null,
		isPrimary: false,
		status: 'active' as const,
		notes: null,
	};
}

function setup() {
	const companies = new FakeCompanies();
	const people = new FakePeople();
	const numbering = new FakeCustomerNumbering();
	const service = new CustomerService(
		companies,
		people,
		unusedCompanyAddresses,
		unusedCustomerAddresses,
		numbering as never,
	);
	const exported = new ExportedCustomerService(companies, people);
	return { companies, people, numbering, service, exported };
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

describe('CustomerService: generated codes', () => {
	test('an omitted company code is generated as customer_company', async () => {
		const { service, numbering } = setup();
		const company = await service.createCompany({ ...companyInput('X'), code: undefined }, ACTOR, 'org-1');
		expect(company.code).toBe('CMP-00001');
		expect(numbering.calls).toEqual([{ codeType: 'customer_company', organizationId: 'org-1' }]);
	});

	test('an omitted person code is generated as customer', async () => {
		const { service } = setup();
		const person = await service.createCustomer({ ...personInput('X'), code: undefined }, ACTOR, 'org-1');
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
		companies.rows[0].deletedAt = new Date();
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

	test('getSnapshot returns null for an unknown id', async () => {
		const { exported } = setup();
		expect(await exported.getSnapshot({ companyId: 'nope' })).toBeNull();
		expect(await exported.getSnapshot({})).toBeNull();
	});

	test('getActiveCustomer hides an inactive person', async () => {
		const { service, exported } = setup();
		const person = await service.createCustomer(personInput('P3'), ACTOR);
		expect(await exported.getActiveCustomer(person.id)).not.toBeNull();
		await service.setCustomerActive(person.id, false);
		expect(await exported.getActiveCustomer(person.id)).toBeNull();
	});
});
