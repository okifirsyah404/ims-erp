/**
 * Service tickets (M07, ADR-0011 step 6c): opened for an active customer with
 * the warranty check stored, references validated, assignment to members
 * who can work tickets, the assignee-only rule, the state machine, and the
 * customer's confirmation to close.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TServiceTicketSelect } from '@drizzle/schemas/aftersales.schema';
import { createTicketSchema } from '../../src/app/aftersales/contracts/service-ticket.contract';
import {
	TicketAssigneeError,
	TicketNotFoundError,
	TicketReferenceError,
	TicketStateError,
} from '../../src/app/aftersales/errors/service-ticket.errors';
import { ServiceTicketService, type TTicketContext } from '../../src/app/aftersales/services/service-ticket.service';

const CUSTOMER = '0190a1b2-0000-7000-8000-00000000c001';
const OTHER = '0190a1b2-0000-7000-8000-00000000c002';
const PROJECT = '0190a1b2-0000-7000-8000-00000000c0a1';

const cs: TTicketContext = { organizationId: 'org', actorUserId: 'cs', canManage: true };
const tech: TTicketContext = { organizationId: 'org', actorUserId: 'tech', canManage: false };

let tickets: TServiceTicketSelect[];
/** Registry calls made by the service (ERP-0044). */
let registered: { code: string; sourceId: string; documentType: string }[];
let service: ServiceTicketService;

beforeEach(() => {
	tickets = [];
	registered = [];
	const roles: Record<string, string> = { cs: 'customer_service', tech: 'technician', sales: 'sales' };
	service = new ServiceTicketService(
		{
			paginate: async (query) => {
				const data = tickets.filter((row) => !query.assigneeUserId || row.assigneeUserId === query.assigneeUserId);
				return { meta: { page: 1, limit: 20, total: data.length, totalPages: 1 }, data };
			},
			findById: async (id) => tickets.find((row) => row.id === id) ?? null,
			listByCustomer: async (customerId) => tickets.filter((row) => row.customerId === customerId),
			async create(data) {
				const row = { ...data, id: crypto.randomUUID(), status: 'new', assigneeUserId: null } as TServiceTicketSelect;
				tickets.push(row);
				return row;
			},
			async transition(id, from, data) {
				const row = tickets.find((ticket) => ticket.id === id);
				return row && from.includes(row.status) ? Object.assign(row, data) : null;
			},
		},
		{
			check: async (query) =>
				query.serialNumber === 'SG-1'
					? { customerId: CUSTOMER, projectId: PROJECT, projectCode: 'PRJ-1', deviceDescription: 'Swing Gate', inWarranty: true, warrantyEndsOn: '2026-12-23', warrantyCode: 'SG-GARANSI-1' }
					: { customerId: null, projectId: null, projectCode: null, deviceDescription: null, inWarranty: false, warrantyEndsOn: null, warrantyCode: null },
		},
		{ getActiveCustomer: async (id: string) => (id === CUSTOMER || id === OTHER ? ({ id, name: `Customer ${id.slice(-4)}` } as never) : null) },
		{ getProject: async (id: string) => (id === PROJECT ? ({ id, customerId: CUSTOMER } as never) : null) },
		{
			getMemberRole: async (_org, userId) => roles[userId] ?? null,
			listMembers: async () => ({ meta: { page: 1, limit: 100, total: 3, totalPages: 1 }, data: Object.entries(roles).map(([userId, role]) => ({ userId, role, user: { name: userId } })) }) as never,
		},
		{ hasPermission: async (_org, names) => names.includes('customer_service') || names.includes('technician') },
		{ getUser: async (id: string) => ({ id, name: `User ${id}` }) as never },
		{ next: async () => '0001/TKT/IMS/XI/26' },
		{
			// ERP-0044: registry side effect is asserted through `registered`.
			register: async (input) => {
				registered.push(input);
				return {} as never;
			},
		},
		// ERP-0022 message thread: not exercised here (see customer-portal.test.ts).
		{ list: async () => [], latestCustomerVisible: async () => new Map(), create: async () => ({}) as never },
	);
});

const open = (extra: Record<string, unknown> = {}) =>
	service.create(cs, createTicketSchema.parse({ customerId: CUSTOMER, channel: 'whatsapp', reporterName: 'Pak Aris', complaint: 'Gate tidak membuka', ...extra }));

describe('service tickets', () => {
	test('opened with the warranty check stored; device and project from the serial', async () => {
		const ticket = await open({ serialNumber: 'SG-1' });
		expect(ticket).toMatchObject({
			code: '0001/TKT/IMS/XI/26',
			status: 'new',
			inWarranty: true,
			warrantyEndsOn: '2026-12-23',
			projectId: PROJECT,
			deviceDescription: 'Swing Gate',
		});
		expect((await open({ serialNumber: 'UNKNOWN' })).inWarranty).toBe(false);
	});

	test('references: active customer, project of that customer, serial of that customer', async () => {
		await expect(open({ customerId: '0190a1b2-0000-7000-8000-00000000c009' })).rejects.toMatchObject({ key: 'aftersales.ticketRef.customer' });
		await expect(open({ customerId: OTHER, projectId: PROJECT })).rejects.toMatchObject({ key: 'aftersales.ticketRef.project' });
		await expect(open({ customerId: OTHER, serialNumber: 'SG-1' })).rejects.toBeInstanceOf(TicketReferenceError);
	});

	test('assignment, assignee-only work, state machine and confirmed close', async () => {
		const ticket = await open();
		await expect(service.get(tech, ticket.id)).rejects.toBeInstanceOf(TicketNotFoundError);
		await expect(service.assign(cs, ticket.id, 'sales')).rejects.toBeInstanceOf(TicketAssigneeError);
		await service.assign(cs, ticket.id, 'tech');
		expect((await service.list(tech, { page: 1, limit: 20 })).data).toHaveLength(1);
		await service.start(tech, ticket.id);
		await expect(service.start(tech, ticket.id)).rejects.toBeInstanceOf(TicketStateError);
		await expect(service.close(cs, ticket.id, { confirmedByName: 'Pak Aris', confirmationChannel: 'phone' })).rejects.toBeInstanceOf(TicketStateError);
		const resolved = await service.resolve(tech, ticket.id, { resolution: 'Ganti sensor', serviceCost: 15_000_000 });
		expect(resolved).toMatchObject({ status: 'resolved', resolvedBy: 'tech', serviceCost: 15_000_000 });
		await service.reopen(tech, ticket.id);
		await service.resolve(tech, ticket.id, { resolution: 'Ganti sensor + kabel', serviceCost: 20_000_000 });
		const closed = await service.close(cs, ticket.id, { confirmedByName: 'Pak Aris', confirmationChannel: 'phone' });
		expect(closed).toMatchObject({ status: 'closed', confirmedByName: 'Pak Aris', closedBy: 'cs' });
		// ERP-0044: the closed ticket is registered once (opening and resolving are not).
		expect(registered).toEqual([
			expect.objectContaining({ code: '0001/TKT/IMS/XI/26', documentType: 'service_ticket', sourceId: ticket.id }),
		]);
	});

	test('a technician only sees tickets assigned to them; a manager works any ticket', async () => {
		const ticket = await open();
		await service.assign(cs, ticket.id, 'tech');
		const other: TTicketContext = { organizationId: 'org', actorUserId: 'tech-2', canManage: false };
		await expect(service.start(other, ticket.id)).rejects.toBeInstanceOf(TicketNotFoundError);
		expect((await service.list(other, { page: 1, limit: 20 })).data).toHaveLength(0);
		expect((await service.start(cs, ticket.id)).status).toBe('in_progress');
	});
});
