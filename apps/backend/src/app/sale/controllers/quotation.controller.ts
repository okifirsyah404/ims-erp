import type { ErpContext } from '@authorization/elysia-auth';
import {
	type IPermissionResolver,
	PERMISSION_RESOLVER_TOKEN,
} from '@authorization/permission-resolver';
import type { ErpPermissionRequest } from '@ims-erp/common';
import { container } from 'tsyringe';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { QUOTATION_SERVICE_TOKEN } from '../constants/di';
import {
	quotationBodySchema,
	quotationDecisionSchema,
	quotationIdParamSchema,
	quotationListQuerySchema,
	quotationLostSchema,
} from '../contracts/quotation.contract';
import type { TQuotationContext } from '../services/quotation.service';

/**
 * REST controller for quotations (`/sales/quotations`, ADR-0011 step 3c).
 *
 * @remarks
 * HTTP concerns only. The visibility flags are resolved with the same
 * dynamic permission resolver the `erp` guard uses, so admin-edited roles
 * apply to the record rules too.
 */
export class QuotationController {
	static plugin() {
		const service = container.resolve(QUOTATION_SERVICE_TOKEN);
		const permissions = container.resolve<IPermissionResolver>(PERMISSION_RESOLVER_TOKEN);

		const context = async (erp: ErpContext): Promise<TQuotationContext> => {
			const roles = erp.member.role.split(',').map((role) => role.trim());
			const can = (request: ErpPermissionRequest) =>
				permissions.hasPermission(erp.organizationId, roles, request);
			const [approve, exportAll, invoices] = await Promise.all([
				can({ quotation: ['approve'] }),
				can({ quotation: ['export'] }),
				can({ invoice: ['read'] }),
			]);
			return { actorUserId: erp.session.user.id, canViewAll: approve || exportAll, canViewDeals: invoices };
		};
		const id = (params: unknown) => quotationIdParamSchema.parse(params).id;

		return domainPlugin({ name: 'sales-quotations', prefix: '/sales/quotations', tags: ['Sales'], guards: 'erp' })
			.get(
				'',
				async ({ query, erp }) =>
					okPaginated(await service.list(await context(erp), quotationListQuerySchema.parse(query))),
				{ erp: { permission: ['quotation:read'] }, detail: { description: 'Paginated quotations visible to the caller' } },
			)
			.get('/:id', async ({ params, erp }) => ok(await service.get(await context(erp), id(params))), {
				erp: { permission: ['quotation:read'] },
				detail: { description: 'One quotation with items, revisions and status history' },
			})
			.post(
				'',
				async ({ body, erp, status }) =>
					status(201, created(await service.create(await context(erp), quotationBodySchema.parse(body)))),
				{ erp: { permission: ['quotation:create'] }, detail: { description: 'Creates a draft quotation' } },
			)
			.patch(
				'/:id',
				async ({ params, body, erp }) =>
					ok(await service.update(await context(erp), id(params), quotationBodySchema.parse(body))),
				{ erp: { permission: ['quotation:update'] }, detail: { description: 'Replaces a draft quotation' } },
			)
			.post('/:id/submit', async ({ params, erp }) => ok(await service.submit(await context(erp), id(params))), {
				erp: { permission: ['quotation:submit'] },
				detail: { description: 'Draft → submitted for approval' },
			})
			.post(
				'/:id/decision',
				async ({ params, body, erp }) =>
					ok(await service.decide(await context(erp), id(params), quotationDecisionSchema.parse(body))),
				{ erp: { permission: ['quotation:approve'] }, detail: { description: 'Approves or rejects (never your own)' } },
			)
			.post('/:id/revisions', async ({ params, erp }) => ok(await service.revise(await context(erp), id(params))), {
				erp: { permission: ['quotation:update'] },
				detail: { description: 'Supersedes the quotation and opens its next draft revision' },
			})
			.post('/:id/send', async ({ params, erp }) => ok(await service.markSent(await context(erp), id(params))), {
				erp: { permission: ['quotation:send'] },
				detail: { description: 'Approved → sent' },
			})
			.post(
				'/:id/lost',
				async ({ params, body, erp }) =>
					ok(await service.markLost(await context(erp), id(params), quotationLostSchema.parse(body))),
				{ erp: { permission: ['quotation:update'] }, detail: { description: 'Open → lost ("Batal") with a reason' } },
			);
	}
}
