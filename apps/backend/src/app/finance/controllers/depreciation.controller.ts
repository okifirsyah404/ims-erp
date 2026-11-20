import { created, ok, okPaginated } from '@http/response';
import { domainPlugin } from '@http/plugin';
import { container } from 'tsyringe';
import { DEPRECIATION_SERVICE_TOKEN } from '../constants/di';
import { depreciationCreateSchema, depreciationListQuerySchema } from '../contracts/depreciation.contract';

/**
 * Depreciation entries (`/finance/depreciations`, ADR-0024 Q15). Permissions
 * ride the existing `asset:*` matrix: reading needs `asset:read`, recording
 * `asset:update`.
 */
export class DepreciationController {
	static plugin() {
		const service = container.resolve(DEPRECIATION_SERVICE_TOKEN);
		return domainPlugin({
			name: 'finance-depreciations',
			prefix: '/finance/depreciations',
			tags: ['Finance'],
			guards: 'erp',
		})
			.get(
				'',
				async ({ query, erp }) =>
					okPaginated(
						await service.list({
							organizationId: erp.organizationId,
							...depreciationListQuerySchema.parse(query),
						}),
					),
				{ erp: { permission: ['asset:read'] }, detail: { description: 'Depreciation entries, newest period first' } },
			)
			.post(
				'',
				async ({ body, erp, status }) =>
					status(201, created(await service.record(erp.organizationId, depreciationCreateSchema.parse(body)))),
				{
					erp: { permission: ['asset:update'] },
					detail: { description: 'Records a depreciation entry; idempotent per item and period (D14)' },
				},
			);
	}
}
