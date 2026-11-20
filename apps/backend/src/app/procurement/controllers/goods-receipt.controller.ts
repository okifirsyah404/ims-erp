import type { ErpContext } from '@authorization/elysia-auth';
import {
	type IPermissionResolver,
	PERMISSION_RESOLVER_TOKEN,
} from '@authorization/permission-resolver';
import { container } from 'tsyringe';
import { z } from 'zod';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { GOODS_RECEIPT_SERVICE_TOKEN } from '../constants/di';
import { createGoodsReceiptSchema, goodsReceiptListQuerySchema } from '../contracts/goods-receipt.contract';
import { idParamSchema } from '../contracts/params.schema';
import type { TGoodsReceiptDetail } from '../services/goods-receipt.service';

/** Unit cost is restricted to `product:read_cost` (owner, finance, purchasing). */
function withoutCost(detail: TGoodsReceiptDetail, canSeeCost: boolean): TGoodsReceiptDetail {
	if (canSeeCost) return detail;
	return { ...detail, items: detail.items.map((item) => ({ ...item, unitCost: 0 })) };
}

/**
 * REST controller for goods receipts (`/goods-receipts`, ADR-0011 step 4b).
 *
 * @remarks
 * Receiving needs `stock:receive` (warehouse, owner); reading `stock:read`.
 * The receivable POs are listed here, so the warehouse needs no PO grant.
 */
export class GoodsReceiptController {
	static plugin() {
		const service = container.resolve(GOODS_RECEIPT_SERVICE_TOKEN);
		const permissions = container.resolve<IPermissionResolver>(PERMISSION_RESOLVER_TOKEN);
		const canSeeCost = (erp: ErpContext) =>
			permissions.hasPermission(erp.organizationId, erp.member.role.split(',').map((role) => role.trim()), {
				product: ['read_cost'],
			});

		return domainPlugin({ name: 'procurement-goods-receipts', prefix: '/procurement/goods-receipts', tags: ['Procurement'], guards: 'erp' })
			.get('', async ({ query }) => okPaginated(await service.list(goodsReceiptListQuerySchema.parse(query))), {
				erp: { permission: ['stock:read'] },
				detail: { description: 'Paginated goods receipts' },
			})
			.get('/warehouses', async () => ok(await service.receivingWarehouses()), {
				erp: { permission: ['stock:receive'] },
				detail: { description: 'Warehouses and storages goods can be received into' },
			})
			.get(
				'/receivable-orders',
				async ({ query }) => ok(await service.receivableOrders(z.object({ search: z.string().trim().max(100).optional() }).parse(query).search)),
				{ erp: { permission: ['stock:receive'] }, detail: { description: 'Purchase orders that can still be received' } },
			)
			.get('/:id', async ({ params, erp }) => ok(withoutCost(await service.get(idParamSchema.parse(params).id), await canSeeCost(erp))), {
				erp: { permission: ['stock:read'] },
				detail: { description: 'One goods receipt with its lines' },
			})
			.post(
				'',
				async ({ body, erp, status }) =>
					status(
						201,
						created(
							withoutCost(
								await service.create(
									{ userId: erp.session.user.id, organizationId: erp.organizationId },
									createGoodsReceiptSchema.parse(body),
								),
								await canSeeCost(erp),
							),
						),
					),
				{ erp: { permission: ['stock:receive'] }, detail: { description: 'Posts a goods receipt (stock, cost and serial units)' } },
			);
	}
}
