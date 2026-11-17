import type { ErpContext } from '@authorization/elysia-auth';
import { type IPermissionResolver, PERMISSION_RESOLVER_TOKEN } from '@authorization/permission-resolver';
import { container } from 'tsyringe';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { SERVICE_TICKET_SERVICE_TOKEN } from '../constants/di';
import {
	assignTicketSchema,
	closeTicketSchema,
	createTicketSchema,
	resolveTicketSchema,
	ticketCommentSchema,
	ticketIdParamSchema,
	ticketListQuerySchema,
	warrantyCheckQuerySchema,
} from '../contracts/service-ticket.contract';
import type { TTicketContext } from '../services/service-ticket.service';

/**
 * REST controller for service tickets (`/service-tickets`, ADR-0011 step
 * 6c). Reading needs `service_ticket:read` (managers see all, others their
 * assigned tickets); creating `:create`; assigning `:assign`; starting and
 * reopening `:update`; resolving `:resolve`; closing `:close`.
 */
export class ServiceTicketController {
	static plugin() {
		const service = container.resolve(SERVICE_TICKET_SERVICE_TOKEN);
		const permissions = container.resolve<IPermissionResolver>(PERMISSION_RESOLVER_TOKEN);
		const context = async (erp: ErpContext): Promise<TTicketContext> => {
			const roles = erp.member.role.split(',').map((role) => role.trim());
			const [assign, close] = await Promise.all([
				permissions.hasPermission(erp.organizationId, roles, { service_ticket: ['assign'] }),
				permissions.hasPermission(erp.organizationId, roles, { service_ticket: ['close'] }),
			]);
			return { organizationId: erp.organizationId, actorUserId: erp.session.user.id, canManage: assign || close };
		};
		const id = (params: unknown) => ticketIdParamSchema.parse(params).id;

		return domainPlugin({ name: 'aftersales-service-tickets', prefix: '/service-tickets', tags: ['After-Sales'], guards: 'erp' })
			.get('', async ({ query, erp }) => okPaginated(await service.list(await context(erp), ticketListQuerySchema.parse(query))), {
				erp: { permission: ['service_ticket:read'] },
				detail: { description: 'Service tickets visible to the caller' },
			})
			.get('/warranty-check', async ({ query }) => ok(await service.checkWarranty(warrantyCheckQuerySchema.parse(query))), {
				erp: { permission: ['service_ticket:create'] },
				detail: { description: 'Warranty status of a serial number or a project, today' },
			})
			.get('/technicians', async ({ erp }) => ok(await service.technicians(await context(erp))), {
				erp: { permission: ['service_ticket:assign'] },
				detail: { description: 'Members who can work tickets' },
			})
			.get('/:id', async ({ params, erp }) => ok(await service.get(await context(erp), id(params))), {
				erp: { permission: ['service_ticket:read'] },
				detail: { description: 'One service ticket' },
			})
			.get('/:id/comments', async ({ params, erp }) => ok(await service.listComments(await context(erp), id(params))), {
				erp: { permission: ['service_ticket:read'] },
				detail: { description: 'The message thread: internal notes, replies and customer messages (ERP-0022)' },
			})
			.post(
				'/:id/comments',
				async ({ params, body, erp, status }) =>
					status(201, created(await service.addComment(await context(erp), id(params), ticketCommentSchema.parse(body)))),
				{
					erp: { permission: ['service_ticket:update'] },
					detail: { description: 'Adds an internal note or a reply the customer sees in the portal (ERP-0022)' },
				},
			)
			.post(
				'',
				async ({ body, erp, status }) => status(201, created(await service.create(await context(erp), createTicketSchema.parse(body)))),
				{ erp: { permission: ['service_ticket:create'] }, detail: { description: 'Opens a ticket (warranty checked and stored)' } },
			)
			.post(
				'/:id/assign',
				async ({ params, body, erp }) => ok(await service.assign(await context(erp), id(params), assignTicketSchema.parse(body).assigneeUserId)),
				{ erp: { permission: ['service_ticket:assign'] }, detail: { description: 'Assigns a technician' } },
			)
			.post('/:id/start', async ({ params, erp }) => ok(await service.start(await context(erp), id(params))), {
				erp: { permission: ['service_ticket:update'] },
				detail: { description: 'new → in progress' },
			})
			.post(
				'/:id/resolve',
				async ({ params, body, erp }) => ok(await service.resolve(await context(erp), id(params), resolveTicketSchema.parse(body))),
				{ erp: { permission: ['service_ticket:resolve'] }, detail: { description: 'Records the resolution and service cost' } },
			)
			.post('/:id/reopen', async ({ params, erp }) => ok(await service.reopen(await context(erp), id(params))), {
				erp: { permission: ['service_ticket:update'] },
				detail: { description: 'resolved → in progress' },
			})
			.post(
				'/:id/close',
				async ({ params, body, erp }) => ok(await service.close(await context(erp), id(params), closeTicketSchema.parse(body))),
				{ erp: { permission: ['service_ticket:close'] }, detail: { description: "Closes with the customer's confirmation" } },
			);
	}
}
