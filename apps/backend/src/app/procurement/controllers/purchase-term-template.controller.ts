import { domainPlugin } from '@http/plugin';
import { created, noContent, ok } from '@http/response';
import { container } from 'tsyringe';
import { PURCHASE_TERM_TEMPLATE_SERVICE_TOKEN } from '../constants/di';
import {
	purchaseTermTemplateBodySchema,
	purchaseTermTemplateParamsSchema,
} from '../contracts/purchase-term-template.contract';

const id = (params: unknown) => purchaseTermTemplateParamsSchema.parse(params).id;

/**
 * REST controller for purchase term templates
 * (`/procurement/purchase-term-templates`, ERP-0165).
 *
 * @remarks
 * Whoever reads purchase orders may read the templates; whoever edits
 * purchase orders may manage them.
 */
export class PurchaseTermTemplateController {
	static plugin() {
		const service = container.resolve(PURCHASE_TERM_TEMPLATE_SERVICE_TOKEN);

		return domainPlugin({
			name: 'procurement-purchase-term-templates',
			prefix: '/procurement/purchase-term-templates',
			tags: ['Procurement'],
			guards: 'erp',
		})
			.get('', async () => ok(await service.list()), {
				erp: { permission: ['purchase_order:read'] },
				detail: { description: 'Purchase term templates, the default first' },
			})
			.get('/:id', async ({ params }) => ok(await service.get(id(params))), {
				erp: { permission: ['purchase_order:read'] },
				detail: { description: 'One purchase term template' },
			})
			.post(
				'',
				async ({ body, erp }) =>
					created(await service.create(purchaseTermTemplateBodySchema.parse(body), erp.session.user.id)),
				{
					erp: { permission: ['purchase_order:update'] },
					detail: { description: 'Creates a purchase term template; unknown placeholders are refused' },
				},
			)
			.put(
				'/:id',
				async ({ params, body, erp }) =>
					ok(await service.update(id(params), purchaseTermTemplateBodySchema.parse(body), erp.session.user.id)),
				{
					erp: { permission: ['purchase_order:update'] },
					detail: { description: 'Replaces a purchase term template' },
				},
			)
			.delete(
				'/:id',
				async ({ params, erp }) => {
					await service.remove(id(params), erp.session.user.id);
					return noContent();
				},
				{
					erp: { permission: ['purchase_order:update'] },
					detail: { description: 'Deletes a purchase term template; orders keep the text they copied' },
				},
			);
	}
}
