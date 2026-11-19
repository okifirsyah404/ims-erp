/**
 * Supplier module unit tests.
 *
 * @remarks
 *.Repository doubles only: no database. Covers the rules the services own —
 * unique company code, activation guards, single primary PIC per company,
 * `ExportedSupplierService` snapshot and bank-detail transport.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type {
	TSupplierCompanySelect,
	TSupplierSelect,
} from '@drizzle/schemas/supplier.schema';
import {
	type TSupplierCompanyCreateInput,
	type TSupplierCompanyListQuery,
	type TSupplierCompanyUpdateInput,
	type TSupplierCreateInput,
	type TSupplierListQuery,
	type TSupplierUpdateInput,
} from '../../src/app/supplier/contracts/supplier.contract';
import type {
	ISupplierCompanyRepository,
	ISupplierRepository,
} from '../../src/app/supplier/contracts/supplier.repository.interface';
import {
	SupplierCompanyCodeTakenError,
	SupplierCompanyNotFoundError,
} from '../../src/app/supplier/errors/supplier.errors';
import { SupplierService } from '../../src/app/supplier/services/supplier.service';
import {
	ExportedSupplierService,
} from '../../src/app/supplier/services/exported-supplier.service';

class FakeCompanies implements ISupplierCompanyRepository {
	rows: TSupplierCompanySelect[] = [];
	private seq = 0;

	private row(partial: Partial<TSupplierCompanySelect>): TSupplierCompanySelect {
		this.seq += 1;
		return {
			id: `c${this.seq}`,
			code: 'SUP1',
			name: 'PT Sumber',
			legalName: null,
			supplierType: 'company',
			taxId: null,
			email: null,
			phone: null,
			whatsapp: null,
			website: null,
			paymentTermsDays: 0,
			paymentTermNote: null,
			bankName: 'BCA',
			bankAccountNumber: '123',
			bankAccountHolder: 'PT Sumber',
			status: 'active',
			notes: null,
			createdBy: null,
			createdAt: new Date(),
			updatedAt: new Date(),
			deletedAt: null,
			...partial,
		};
	}

	async paginate(query: TSupplierCompanyListQuery) {
		return this.rows.filter((row) => row.deletedAt === null);
	}

	async count() {
		return this.rows.filter((row) => row.deletedAt === null).length;
	}

	async findById(id: string) {
		return this.rows.find((row) => row.id === id && row.deletedAt === null) ?? null;
	}

	async findByCode(code: string) {
		return (
			this.rows.find((row) => row.code === code && row.deletedAt === null) ??
			null
		);
	}

	async create(data: TSupplierCompanyCreateInput & { createdBy: string }) {
		const row = this.row({ ...data } as Partial<TSupplierCompanySelect>);
		this.rows.push(row);
		return row;
	}

	async update(id: string, patch: TSupplierCompanyUpdateInput) {
		const row = await this.findById(id);
		if (!row) return null;
		Object.assign(row, patch);
		return row;
	}

	async transitionStatus(
		id: string,
		from: 'active' | 'inactive',
		to: 'active' | 'inactive',
	) {
		const row = this.rows.find(
			(candidate) => candidate.id === id && candidate.status === from,
		);
		if (!row) return null;
		row.status = to;
		return row;
	}
}

class FakePeople implements ISupplierRepository {
	rows: TSupplierSelect[] = [];
	private seq = 0;

	private row(partial: Partial<TSupplierSelect>): TSupplierSelect {
		this.seq += 1;
		return {
			id: `p${this.seq}`,
			companyId: null,
			name: 'Budi',
			title: null,
			phone: null,
			email: null,
			whatsapp: null,
			isPrimary: false,
			status: 'active',
			notes: null,
			createdBy: null,
			createdAt: new Date(),
			updatedAt: new Date(),
			deletedAt: null,
			...partial,
		};
	}

	async paginate(query: TSupplierListQuery) {
		return this.rows.filter(
			(row) =>
				row.deletedAt === null &&
				(query.companyId ? row.companyId === query.companyId : true),
		);
	}

	async count(query: TSupplierListQuery) {
		return (await this.paginate(query)).length;
	}

	async findById(id: string) {
		return this.rows.find((row) => row.id === id && row.deletedAt === null) ?? null;
	}

	async create(data: TSupplierCreateInput & { createdBy: string }) {
		if (data.isPrimary && data.companyId) {
			for (const row of this.rows) {
				if (row.companyId === data.companyId) row.isPrimary = false;
			}
		}
		const row = this.row({ ...data } as Partial<TSupplierSelect>);
		this.rows.push(row);
		return row;
	}

	async update(id: string, patch: TSupplierUpdateInput) {
		const row = await this.findById(id);
		if (!row) return null;
		if (patch.isPrimary && row.companyId) {
			for (const other of this.rows) {
				if (other.companyId === row.companyId && other.id !== id) {
					other.isPrimary = false;
				}
			}
		}
		Object.assign(row, patch);
		return row;
	}

	async softDelete(id: string) {
		const row = await this.findById(id);
		if (!row) return false;
		row.deletedAt = new Date();
		return true;
	}
}

describe('SupplierService', () => {
	let companies: FakeCompanies;
	let people: FakePeople;
	let service: SupplierService;

	beforeEach(() => {
		companies = new FakeCompanies();
		people = new FakePeople();
		service = new SupplierService(companies, people);
	});

	test('rejects a duplicate company code', async () => {
		await service.createCompany(
			{ code: 'ACME', name: 'PT Acme', supplierType: 'company', paymentTermsDays: 0 } as TSupplierCompanyCreateInput,
			'u1',
		);
		expect(
			service.createCompany(
				{ code: 'ACME', name: 'PT Lain', supplierType: 'company', paymentTermsDays: 0 } as TSupplierCompanyCreateInput,
				'u1',
			),
		).rejects.toBeInstanceOf(SupplierCompanyCodeTakenError);
	});

	test('activation guards return 409 on the same status', async () => {
		const company = await service.createCompany(
			{ code: 'ACME', name: 'PT Acme', supplierType: 'company', paymentTermsDays: 0 } as TSupplierCompanyCreateInput,
			'u1',
		);
		expect(service.setCompanyActive(company.id, true)).rejects.toThrowError();
		const updated = await service.setCompanyActive(company.id, false);
		expect(updated?.status).toBe('inactive');
	});

	test('unknown company id surfaces SupplierCompanyNotFoundError', () => {
		expect(service.getCompany('missing')).rejects.toBeInstanceOf(
			SupplierCompanyNotFoundError,
		);
	});

	test('a new primary PIC clears the previous one', async () => {
		const company = await service.createCompany(
			{ code: 'ACME', name: 'PT Acme', supplierType: 'company', paymentTermsDays: 0 } as TSupplierCompanyCreateInput,
			'u1',
		);
		const first = await service.createPerson(
			{ name: 'A', isPrimary: true, companyId: company.id } as TSupplierCreateInput,
			'u1',
		);
		const second = await service.createPerson(
			{ name: 'B', isPrimary: true, companyId: company.id } as TSupplierCreateInput,
			'u1',
		);
		expect(first.isPrimary).toBe(false);
		expect(second.isPrimary).toBe(true);
	});

	test('removing a person is a soft delete', async () => {
		const person = await service.createPerson(
			{ name: 'A' } as TSupplierCreateInput,
			'u1',
		);
		await service.removePerson(person.id);
		expect(await people.findById(person.id)).toBeNull();
	});
});

describe('ExportedSupplierService', () => {
	let companies: FakeCompanies;
	let people: FakePeople;
	let exported: ExportedSupplierService;

	beforeEach(() => {
		companies = new FakeCompanies();
		people = new FakePeople();
		exported = new ExportedSupplierService(companies, people);
	});

	test('assertActiveCompany rejects unknown ids', () => {
		expect(exported.assertActiveCompany('missing')).rejects.toBeInstanceOf(
			SupplierCompanyNotFoundError,
		);
	});

	test('getPurchaseSnapshot carries code and tax id', async () => {
		const company = await companies.create(
			{
				code: 'ACME',
				name: 'PT Acme',
				taxId: '123456789012345',
			} as TSupplierCompanyCreateInput & { createdBy: string },
		);
		const snapshot = await exported.getPurchaseSnapshot(company.id);
		expect(snapshot.code).toBe('ACME');
		expect(snapshot.taxId).toBe('123456789012345');
	});

	test('getBankDetails transports the bank columns', async () => {
		const company = await companies.create(
			{
				code: 'ACME',
				name: 'PT Acme',
				bankName: 'BCA',
				bankAccountNumber: '1234567890',
				bankAccountHolder: 'PT Acme',
			} as TSupplierCompanyCreateInput & { createdBy: string },
		);
		const details = await exported.getBankDetails(company.id);
		expect(details?.bankName).toBe('BCA');
		expect(details?.bankAccountNumber).toBe('1234567890');
	});
});
