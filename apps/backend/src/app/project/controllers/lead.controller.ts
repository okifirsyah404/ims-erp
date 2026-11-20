import type { ErpContext } from '@authorization/elysia-auth';
import {
	type IPermissionResolver,
	PERMISSION_RESOLVER_TOKEN,
} from '@authorization/permission-resolver';
import { container } from 'tsyringe';
import { domainPlugin } from '@http/plugin';
import { created, noContent, ok, okPaginated } from '@http/response';
import { LEAD_SERVICE_TOKEN } from '../constants/di';
import {
	assignLeadSchema,
	convertLeadSchema,
	createLeadSchema,
	leadActivitySchema,
	leadAttachmentParamSchema,
	leadIdParamSchema,
	leadListQuerySchema,
	leadStatusSchema,
	updateLeadSchema,
} from '../contracts/lead.contract';
import type { TLeadContext } from '../services/lead.service';

/**
 * REST controller for leads (`/leads`, ADR-0011 step 3b).
 *
 * @remarks
 * HTTP concerns only. `canManage` (`lead:assign`) is resolved with the same
 * dynamic permission resolver the `erp` guard uses, so admin-edited roles
 * apply to the record rule too.
 */
export class LeadController {
	static plugin() {
		const service = container.resolve(LEAD_SERVICE_TOKEN);
		const permissions = container.resolve<IPermissionResolver>(PERMISSION_RESOLVER_TOKEN);

		const context = async (erp: ErpContext): Promise<TLeadContext> => {
			const roles = erp.member.role.split(',').map((role) => role.trim());
			return {
				organizationId: erp.organizationId,
				actorUserId: erp.session.user.id,
				canManage: await permissions.hasPermission(erp.organizationId, roles, { lead: ['assign'] }),
			};
		};
		const id = (params: unknown) => leadIdParamSchema.parse(params).id;

		return domainPlugin({ name: 'project-leads', prefix: '/projects/leads', tags: ['Project'], guards: 'erp' })
			.get(
				'',
				async ({ query, erp }) => okPaginated(await service.list(await context(erp), leadListQuerySchema.parse(query))),
				{ erp: { permission: ['lead:read'] }, detail: { description: 'Paginated leads visible to the caller' } },
			)
			.get('/:id', async ({ params, erp }) => ok(await service.get(await context(erp), id(params))), {
				erp: { permission: ['lead:read'] },
				detail: { description: 'One lead with activities and attachments' },
			})
			.get(
				'/:id/attachments/:attachmentId/url',
				async ({ params, erp }) => {
					const { id: leadId, attachmentId } = leadAttachmentParamSchema.parse(params);
					return ok(await service.attachmentUrl(await context(erp), leadId, attachmentId));
				},
				{ erp: { permission: ['lead:read'] }, detail: { description: 'Short-lived attachment download URL' } },
			)
			.post(
				'',
				async ({ body, erp, status }) =>
					status(201, created(await service.create(await context(erp), createLeadSchema.parse(body)))),
				{ erp: { permission: ['lead:create'] }, detail: { description: 'Creates a lead' } },
			)
			.patch(
				'/:id',
				async ({ params, body, erp }) =>
					ok(await service.update(await context(erp), id(params), updateLeadSchema.parse(body))),
				{ erp: { permission: ['lead:update'] }, detail: { description: 'Updates an open lead' } },
			)
			.post(
				'/:id/status',
				async ({ params, body, erp }) =>
					ok(await service.changeStatus(await context(erp), id(params), leadStatusSchema.parse(body))),
				{ erp: { permission: ['lead:update'] }, detail: { description: 'Moves an open lead, or marks it lost' } },
			)
			.post(
				'/:id/assign',
				async ({ params, body, erp }) =>
					ok(await service.assign(await context(erp), id(params), assignLeadSchema.parse(body).userId)),
				{ erp: { permission: ['lead:assign'] }, detail: { description: 'Assigns or unassigns a lead' } },
			)
			.post(
				'/:id/activities',
				async ({ params, body, erp, status }) =>
					status(201, created(await service.addActivity(await context(erp), id(params), leadActivitySchema.parse(body)))),
				{ erp: { permission: ['lead:update'] }, detail: { description: 'Logs a follow-up activity' } },
			)
			.post(
				'/:id/convert',
				async ({ params, body, erp }) =>
					ok(await service.convert(await context(erp), id(params), convertLeadSchema.parse(body))),
				{
					erp: { permission: ['lead:update', 'customer:create'] },
					detail: { description: 'Converts a lead into a customer (won)' },
				},
			)
			.delete(
				'/:id',
				async ({ params, erp }) => {
					await service.archive(await context(erp), id(params));
					return noContent();
				},
				{ erp: { permission: ['lead:archive'] }, detail: { description: 'Archives a lead (soft delete)' } },
			);
	}
}
