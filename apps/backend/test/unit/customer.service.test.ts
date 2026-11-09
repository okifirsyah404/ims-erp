/**
 * Customer service unit tests (ADR-0011 port step 3a).
 *
 * @remarks
 * Company-wide customers: unique live codes (pre-check and the race path),
 * the village checked through the Location contract, active/inactive
 * transitions, and `getActiveCustomer` as the contract other modules use.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type {
	CustomerStatus,
	TCustomerContactSelect,
	TCustomerSelect,
} from '@drizzle/schemas/crm.schema';
import {
	createCustomerSchema,
	type TCreateContactInput,
	type TCreateCustomerInput,
	type TCustomerListQuery,
	type TUpdateContactInput,
	type TUpdateCustomerInput,
} from '../../src/app/crm/contracts/customer.contract';
import type {
	ICustomerContactRepository,
	ICustomerRepository,
} from '../../src/app/crm/contracts/customer.repository.interface';
import {
	CustomerCodeTakenError,
	CustomerContactNotFoundError,
	CustomerNotFoundError,
	CustomerStatusUnchangedError,
	VillageNotFoundError,
} from '../../src/app/crm/errors/crm.errors';
import { CustomerService } from '../../src/app/crm/services/customer.service';

const KNOWN_VILLAGE = '01920000-0000-7000-8000-0000000000e1';

class FakeCustomers implements ICustomerRepository {
	rows: TCustomerSelect[] = [];
	/** Simulates a concurrent insert winning between pre-check and insert. */
	raceOnNextCreate = false;

	async paginate(_query: TCustomerListQuery) {
		return { meta: { page: 1, limit: 20, total: this.rows.length, totalPages: 1 }, data: this.rows };
	}
	async findById(id: string) {
		return this.rows.find((r) => r.id === id) ?? null;
	}
	async findByCode(code: string) {
		return this.rows.find((r) => r.code === code) ?? null;
	}
	async create(data: TCreateCustomerInput & { createdBy: string }) {
		if (this.raceOnNextCreate) {
			this.raceOnNextCreate = false;
			throw Object.assign(new Error('duplicate key'), { cause: { code: '23505' } });
		}
		const row = { ...data, id: crypto.randomUUID(), status: 'active' } as TCustomerSelect;
		this.rows.push(row);
		return row;
	}
	async update(id: string, patch: TUpdateCustomerInput) {
		const row = await this.findById(id);
		return row ? Object.assign(row, patch) : null;
	}
	async transitionStatus(id: string, from: CustomerStatus, to: CustomerStatus) {
		const row = await this.findById(id);
		return row && row.status === from ? Object.assign(row, { status: to }) : null;
	}
}

class FakeContacts implements ICustomerContactRepository {
	rows: (TCustomerContactSelect & { deleted?: boolean })[] = [];
	async listByCustomer(customerId: string) {
		return this.rows.filter((r) => r.customerId === customerId && !r.deleted);
	}
	async create(customerId: string, data: TCreateContactInput) {
		const row = { ...data, id: crypto.randomUUID(), customerId } as TCustomerContactSelect;
		this.rows.push(row);
		return row;
	}
	async update(customerId: string, id: string, patch: TUpdateContactInput) {
		const row = this.rows.find((r) => r.id === id && r.customerId === customerId && !r.deleted);
		return row ? Object.assign(row, patch) : null;
	}
	async findById(customerId: string, id: string) {
		return this.rows.find((r) => r.id === id && r.customerId === customerId && !r.deleted) ?? null;
	}
	async softDelete(customerId: string, id: string) {
		const row = this.rows.find((r) => r.id === id && r.customerId === customerId && !r.deleted);
		if (row) row.deleted = true;
		return !!row;
	}
}

const input = (code: string, extra: Record<string, unknown> = {}) =>
	createCustomerSchema.parse({ code, customerType: 'company', name: `PT ${code}`, ...extra });

describe('CustomerService', () => {
	let customers: FakeCustomers;
	let contacts: FakeContacts;
	let service: CustomerService;

	beforeEach(() => {
		customers = new FakeCustomers();
		contacts = new FakeContacts();
		service = new CustomerService(customers, contacts, {
			getVillage: async (id: string) => (id === KNOWN_VILLAGE ? ({ id } as never) : null),
		});
	});

	test('input is normalised: upper-case code, NPWP digits, empty text to null', () => {
		const parsed = input('cus-01', { taxId: '01.234.567.8-901.000', email: '', notes: '  ' });
		expect(parsed.code).toBe('CUS-01');
		expect(parsed.taxId).toBe('012345678901000');
		expect(parsed.email).toBeNull();
		expect(parsed.notes).toBeNull();
		expect(() => input('CUS', { taxId: '123' })).toThrow();
	});

	test('codes are unique among live customers, including the race path', async () => {
		const created = await service.create(input('CUS-01'), 'user-1');
		expect(created.createdBy).toBe('user-1');
		await expect(service.create(input('cus-01'), 'user-1')).rejects.toBeInstanceOf(CustomerCodeTakenError);
		customers.raceOnNextCreate = true;
		await expect(service.create(input('CUS-02'), 'user-1')).rejects.toBeInstanceOf(CustomerCodeTakenError);
		// Renaming onto another customer's code is refused too; keeping one's own is fine.
		const other = await service.create(input('CUS-03'), 'user-1');
		await expect(service.update(other.id, { code: 'CUS-01' })).rejects.toBeInstanceOf(CustomerCodeTakenError);
		await expect(service.update(other.id, { code: 'CUS-03', name: 'Baru' })).resolves.toMatchObject({ name: 'Baru' });
	});

	test('the address village is checked through the Location contract', async () => {
		await expect(
			service.create(input('CUS-01', { villageId: '01920000-0000-7000-8000-0000000000ff' }), 'user-1'),
		).rejects.toBeInstanceOf(VillageNotFoundError);
		await expect(service.create(input('CUS-01', { villageId: KNOWN_VILLAGE }), 'user-1')).resolves.toBeDefined();
	});

	test('deactivated customers are not offered to other modules; transitions are idempotent-safe', async () => {
		const customer = await service.create(input('CUS-01'), 'user-1');
		expect(await service.getActiveCustomer(customer.id)).not.toBeNull();
		await service.setActive(customer.id, false);
		expect(await service.getActiveCustomer(customer.id)).toBeNull();
		await expect(service.setActive(customer.id, false)).rejects.toBeInstanceOf(CustomerStatusUnchangedError);
		await service.setActive(customer.id, true);
		expect(await service.getActiveCustomer(customer.id)).not.toBeNull();
		await expect(service.get('01920000-0000-7000-8000-000000000404')).rejects.toBeInstanceOf(CustomerNotFoundError);
	});

	test('contacts belong to their customer; a removed contact is gone', async () => {
		const customer = await service.create(input('CUS-01'), 'user-1');
		const other = await service.create(input('CUS-02'), 'user-1');
		const contact = await service.addContact(customer.id, { name: 'Budi', position: null, email: null, phone: null, whatsapp: null, isPrimary: true });
		expect((await service.get(customer.id)).contacts).toHaveLength(1);
		await expect(service.updateContact(other.id, contact.id, { name: 'X' })).rejects.toBeInstanceOf(
			CustomerContactNotFoundError,
		);
		await service.removeContact(customer.id, contact.id);
		expect((await service.get(customer.id)).contacts).toHaveLength(0);
		await expect(service.removeContact(customer.id, contact.id)).rejects.toBeInstanceOf(CustomerContactNotFoundError);
	});
});
