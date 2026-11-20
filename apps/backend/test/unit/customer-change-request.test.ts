/**
 * Company-data change requests from the customer portal (ERP-0076).
 *
 * Covers: only the fields that differ are requested (no NPWP sent = keep it),
 * nothing to change is refused, a new request supersedes the pending one, the
 * account manager is notified, approving writes the values to the customer,
 * rejecting leaves it, and a decided or foreign request is not pending.
 */
import 'reflect-metadata';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TCustomerChangeRequestSelect } from '@drizzle/schemas/crm.schema';
import type { ICustomerChangeRequestRepository } from '../../src/app/crm/contracts/customer-change-request.contract';
import { CustomerChangeNotCompanyError, CustomerChangeNotPendingError, CustomerChangeUnchangedError, CustomerNotFoundError } from '../../src/app/crm/errors/crm.errors';
import { CustomerChangeRequestService } from '../../src/app/crm/services/customer-change-request.service';

let rows: TCustomerChangeRequestSelect[];
let customer: { id: string; code: string; customerType: string; name: string; taxId: string | null; industry: string | null; ownerUserId: string | null };
let notified: { userIds: string[]; variables: Record<string, unknown> }[];
let service: CustomerChangeRequestService;

const actor = { userId: 'u1', name: 'Dewi' };

beforeEach(() => {
	rows = [];
	notified = [];
	customer = { id: 'c1', code: 'C-001', customerType: 'company', name: 'PT Maju', taxId: '012345678901234', industry: null, ownerUserId: 'sales-1' };
	const repository: ICustomerChangeRequestRepository = {
		list: async (customerId) => rows.filter((row) => row.customerId === customerId).reverse(),
		findPending: async (customerId) => rows.find((row) => row.customerId === customerId && row.status === 'pending') ?? null,
		create: async (data) => {
			rows.filter((row) => row.customerId === data.customerId && row.status === 'pending').forEach((row) => (row.status = 'superseded'));
			const row = { ...data, id: crypto.randomUUID(), status: 'pending', decidedByUserId: null, decidedAt: null, decisionNote: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null } as TCustomerChangeRequestSelect;
			rows.push(row);
			return row;
		},
		decide: async (id, status, actorUserId, note) => {
			const row = rows.find((entry) => entry.id === id && entry.status === 'pending');
			return row ? Object.assign(row, { status, decidedByUserId: actorUserId, decisionNote: note }) : null;
		},
	};
	service = new CustomerChangeRequestService(
		repository,
		{
			getActiveCustomer: async (id) => (id === customer.id ? (customer as never) : null),
			update: async (_id, patch) => Object.assign(customer, patch) as never,
		},
		{ notify: async (input) => void notified.push({ userIds: input.userIds, variables: input.variables ?? {} }) },
	);
});

describe('CustomerChangeRequestService', () => {
	test('only what differs is requested; the account manager is notified', async () => {
		const request = await service.request('c1', actor, { name: 'PT Maju Jaya', industry: 'Retail' });
		expect(request.changes).toEqual({ name: 'PT Maju Jaya', industry: 'Retail' });
		expect(request.previous).toEqual({ name: 'PT Maju', industry: null });
		expect(notified).toEqual([{ userIds: ['sales-1'], variables: { customerName: 'PT Maju', requestedBy: 'Dewi', fields: 'nama, bidang usaha' } }]);
		await expect(service.request('c1', actor, { name: 'PT Maju', npwp: '012345678901234', industry: null })).rejects.toBeInstanceOf(CustomerChangeUnchangedError);
		await expect(service.request('nope', actor, { name: 'X', industry: null })).rejects.toBeInstanceOf(CustomerNotFoundError);
	});

	test('an individual customer has no company data to change', async () => {
		customer.customerType = 'individual';
		await expect(service.request('c1', actor, { name: 'X', industry: null })).rejects.toBeInstanceOf(CustomerChangeNotCompanyError);
		expect(rows).toEqual([]);
	});

	test('a new request supersedes the pending one', async () => {
		const first = await service.request('c1', actor, { name: 'PT A', industry: null });
		const second = await service.request('c1', actor, { name: 'PT B', industry: null });
		expect(rows.find((row) => row.id === first.id)!.status).toBe('superseded');
		expect((await service.pending('c1'))!.id).toBe(second.id);
		await expect(service.approve('c1', first.id, 'staff-1', null)).rejects.toBeInstanceOf(CustomerChangeNotPendingError);
	});

	test('approving writes the values; rejecting leaves the customer; a decided request is not pending', async () => {
		const request = await service.request('c1', actor, { name: 'PT Maju Jaya', npwp: '0123456789012340', industry: null });
		await expect(service.approve('c2', request.id, 'staff-1', null)).rejects.toBeInstanceOf(CustomerChangeNotPendingError);
		const approved = await service.approve('c1', request.id, 'staff-1', 'Cek akta OK');
		expect(approved).toMatchObject({ status: 'approved', decidedByUserId: 'staff-1', decisionNote: 'Cek akta OK' });
		expect(customer).toMatchObject({ name: 'PT Maju Jaya', taxId: '0123456789012340' });
		await expect(service.reject('c1', request.id, 'staff-1', null)).rejects.toBeInstanceOf(CustomerChangeNotPendingError);

		const other = await service.request('c1', actor, { name: 'PT Lain', industry: null });
		await service.reject('c1', other.id, 'staff-1', 'Tidak sesuai NPWP');
		expect(customer.name).toBe('PT Maju Jaya');
		expect(await service.pending('c1')).toBeNull();
	});
});
