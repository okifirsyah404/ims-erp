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
	TSupplierAddressSelect,
	TSupplierCompanyAddressSelect,
	TSupplierCompanySelect,
	TSupplierSelect,
} from '@drizzle/schemas/supplier.schema';
import {
	type TSupplierCompanyCreateInput,
	type TSupplierCompanyUpdateInput,
	type TSupplierCreateInput,
	type TSupplierUpdateInput,
} from '../../src/app/supplier/contracts/supplier.contract';
import type {
	TSupplierCompanyPaginationRequest,
	TSupplierPaginationRequest,
} from '../../src/app/supplier/contracts/supplier.repository.interface';
import type {
	ISupplierAddressRepository,
	ISupplierCompanyAddressRepository,
	ISupplierCompanyRepository,
	ISupplierRepository,
} from '../../src/app/supplier/contracts/supplier.repository.interface';
import {
	SupplierAddressNotFoundError,
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
			website: null,
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

	async paginate(request: TSupplierCompanyPaginationRequest) {
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

	async paginate(request: TSupplierPaginationRequest) {
		const rows = this.rows.filter(
			(row) =>
				row.deletedAt === null &&
				(request.companyId ? row.companyId === request.companyId : true),
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

/** Numbering double: records the organization it was asked for. */
class FakeSupplierNumbering {
	calls: { codeType: string; organizationId: string | null | undefined }[] = [];
	private seq = 0;

	async next(codeType: string, _tx?: unknown, _date?: Date, organizationId?: string | null) {
		this.calls.push({ codeType, organizationId });
		this.seq += 1;
		return `IMS-ORG-SUP-${String(this.seq).padStart(5, '0')}`;
	}
}

/** Location double: accepts every village id. */
class FakeLocation {
	ids: string[] = [];
	async assertVillage(villageId: string) {
		this.ids.push(villageId);
		return { id: villageId } as never;
	}
}

class FakeCompanyAddresses
	implements ISupplierCompanyAddressRepository
{
	rows: TSupplierCompanyAddressSelect[] = [];
	private seq = 0;

	private row(
		companyId: string,
		partial: Partial<TSupplierCompanyAddressSelect>,
	): TSupplierCompanyAddressSelect {
		this.seq += 1;
		return {
			id: `ca${this.seq}`,
			companyId,
			kind: 'office',
			label: null,
			contactName: null,
			contactPhone: null,
			addressLine: 'Jl. Mawar 1',
			villageId: null,
			postalCode: null,
			isPrimary: false,
			createdAt: new Date(),
			updatedAt: new Date(),
			deletedAt: null,
			...partial,
		};
	}

	async listByCompany(companyId: string) {
		return this.rows.filter(
			(row) => row.companyId === companyId && row.deletedAt === null,
		);
	}

	async findById(companyId: string, addressId: string) {
		return (
			this.rows.find(
				(row) =>
					row.companyId === companyId &&
					row.id === addressId &&
					row.deletedAt === null,
			) ?? null
		);
	}

	async create(companyId: string, data: never) {
		const row = this.row(companyId, data as never);
		this.rows.push(row);
		return row;
	}

	async update(companyId: string, addressId: string, patch: never) {
		const row = await this.findById(companyId, addressId);
		if (!row) return null;
		Object.assign(row, patch);
		return row;
	}

	async softDelete(companyId: string, addressId: string) {
		const row = await this.findById(companyId, addressId);
		if (!row) return false;
		row.deletedAt = new Date();
		return true;
	}
}

class FakePersonAddresses implements ISupplierAddressRepository {
	rows: TSupplierAddressSelect[] = [];
	private seq = 0;

	private row(
		supplierId: string,
		partial: Partial<TSupplierAddressSelect>,
	): TSupplierAddressSelect {
		this.seq += 1;
		return {
			id: `pa${this.seq}`,
			supplierId,
			kind: 'office',
			label: null,
			addressLine: 'Jl. Melati 2',
			villageId: null,
			postalCode: null,
			isPrimary: false,
			createdAt: new Date(),
			updatedAt: new Date(),
			deletedAt: null,
			...partial,
		};
	}

	async listByPerson(supplierId: string) {
		return this.rows.filter(
			(row) => row.supplierId === supplierId && row.deletedAt === null,
		);
	}

	async findById(supplierId: string, addressId: string) {
		return (
			this.rows.find(
				(row) =>
					row.supplierId === supplierId &&
					row.id === addressId &&
					row.deletedAt === null,
			) ?? null
		);
	}

	async create(supplierId: string, data: never) {
		const row = this.row(supplierId, data as never);
		this.rows.push(row);
		return row;
	}

	async update(supplierId: string, addressId: string, patch: never) {
		const row = await this.findById(supplierId, addressId);
		if (!row) return null;
		Object.assign(row, patch);
		return row;
	}

	async softDelete(supplierId: string, addressId: string) {
		const row = await this.findById(supplierId, addressId);
		if (!row) return false;
		row.deletedAt = new Date();
		return true;
	}
}

describe('SupplierService', () => {
	let companies: FakeCompanies;
	let people: FakePeople;
	let numbering: FakeSupplierNumbering;
	let companyAddresses: FakeCompanyAddresses;
	let personAddresses: FakePersonAddresses;
	let location: FakeLocation;
	let service: SupplierService;

	beforeEach(() => {
		companies = new FakeCompanies();
		people = new FakePeople();
		numbering = new FakeSupplierNumbering();
		companyAddresses = new FakeCompanyAddresses();
		personAddresses = new FakePersonAddresses();
		location = new FakeLocation();
		service = new SupplierService(
			companies,
			people,
			numbering as never,
			companyAddresses,
			personAddresses,
			location as never,
		);
	});

	test('an empty code is generated with the caller organization', async () => {
		const company = await service.createCompany(
			{ name: 'PT Acme', supplierType: 'company', paymentTermsDays: 0 } as TSupplierCompanyCreateInput,
			'u1',
			'org-1',
		);
		expect(company.code).toBe('IMS-ORG-SUP-00001');
		expect(numbering.calls).toEqual([{ codeType: 'supplier_company', organizationId: 'org-1' }]);
	});

	test('a typed code is kept and nothing is allocated', async () => {
		const company = await service.createCompany(
			{ code: 'HIT', name: 'PT Hit', supplierType: 'company', paymentTermsDays: 0 } as TSupplierCompanyCreateInput,
			'u1',
			'org-1',
		);
		expect(company.code).toBe('HIT');
		expect(numbering.calls).toHaveLength(0);
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

	test('a company address is created owner-scoped and the village is validated', async () => {
		const company = await service.createCompany(
			{ code: 'ACME', name: 'PT Acme', supplierType: 'company' } as TSupplierCompanyCreateInput,
			'u1',
		);
		const address = await service.addCompanyAddress(company.id, {
			kind: 'office',
			addressLine: 'Jl. Mawar 1',
			villageId: 'v1',
			postalCode: null,
			isPrimary: true,
			label: null,
			contactName: null,
			contactPhone: null,
		});
		expect(address.companyId).toBe(company.id);
		expect(location.ids).toEqual(['v1']);
		expect(await service.getCompany(company.id)).toMatchObject({
			addresses: [expect.objectContaining({ addressLine: 'Jl. Mawar 1' })],
		});
	});

	test('an unknown company id is refused for address creation', () => {
		expect(
			service.addCompanyAddress('missing', {
				addressLine: 'Jl. Mawar 1',
				kind: 'office',
				villageId: null,
				postalCode: null,
				isPrimary: false,
				label: null,
				contactName: null,
				contactPhone: null,
			}),
		).rejects.toBeInstanceOf(SupplierCompanyNotFoundError);
	});

	test('updating or removing a missing address throws SupplierAddressNotFoundError', async () => {
		const company = await service.createCompany(
			{ code: 'ACME', name: 'PT Acme', supplierType: 'company' } as TSupplierCompanyCreateInput,
			'u1',
		);
		expect(
			service.updateCompanyAddress(company.id, 'missing', {}),
		).rejects.toBeInstanceOf(SupplierAddressNotFoundError);
		expect(
			service.removeCompanyAddress(company.id, 'missing'),
		).rejects.toBeInstanceOf(SupplierAddressNotFoundError);
	});

	test('a person address is created owner-scoped', async () => {
		const person = await service.createPerson(
			{ name: 'A' } as TSupplierCreateInput,
			'u1',
		);
		const address = await service.addPersonAddress(person.id, {
			kind: 'other',
			addressLine: 'Jl. Melati 2',
			villageId: null,
			postalCode: null,
			isPrimary: false,
			label: null,
		});
		expect(address.supplierId).toBe(person.id);
	});
});

describe('ExportedSupplierService', () => {
	let companies: FakeCompanies;
	let people: FakePeople;
	let exported: ExportedSupplierService;

	beforeEach(() => {
		companies = new FakeCompanies();
		people = new FakePeople();
		exported = new ExportedSupplierService(
			companies,
			people,
			new FakeCompanyAddresses(),
			people,
			new FakePersonAddresses(),
		);
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
