import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import {
	costCenterCreateSchema,
	costCenterListQuerySchema,
	costCenterUpdateSchema,
	ledgerIdParamSchema,
	postingRuleCreateSchema,
	postingRuleListQuerySchema,
	postingRuleUpdateSchema,
} from '../contracts/ledger.contract';
import { COST_CENTER_SERVICE_TOKEN, POSTING_RULE_SERVICE_TOKEN } from '../constants/di';
import type { CostCenterService } from '../services/cost-center.service';
import type { PostingRuleService } from '../services/posting-rule.service';

/**
 * `/finance/cost-centers` and `/finance/posting-rules` (ERP-0127, ERP-0128).
 *
 * @remarks
 * Accounting set-up surfaces: the cost-centre master and the account
 * determination table behind `postBusinessEvent`. Guarded by the
 * `cost_center:*` and `posting_rule:*` permissions (accountant full; finance
 * and auditor read; owner by blanket grant). HTTP only: parse, call, envelope.
 */
export class FinanceSetupController {
	static plugin() {
		const costCenters = container.resolve<CostCenterService>(COST_CENTER_SERVICE_TOKEN);
		const rules = container.resolve<PostingRuleService>(POSTING_RULE_SERVICE_TOKEN);
		const ctxOf = (erp: ErpContext) => ({
			organizationId: erp.organizationId,
			actorUserId: erp.session.user.id,
		});

		return domainPlugin({
			name: 'finance-setup',
			prefix: '/finance',
			tags: ['Accounting'],
			guards: 'erp',
		})
			/* ---------------- cost centres ---------------- */
			.get(
				'/cost-centers',
				async ({ query, erp }) =>
					okPaginated(
						await costCenters.list({
							organizationId: erp.organizationId,
							...costCenterListQuerySchema.parse(query),
						}),
					),
				{
					erp: { permission: ['cost_center:read'] },
					detail: { description: 'Paginated cost centres' },
				},
			)
			.get(
				'/cost-centers/:id',
				async ({ params, erp }) =>
					ok(await costCenters.get(erp.organizationId, ledgerIdParamSchema.parse(params).id)),
				{
					erp: { permission: ['cost_center:read'] },
					detail: { description: 'One cost centre' },
				},
			)
			.post(
				'/cost-centers',
				async ({ body, erp, status }) =>
					status(201, created(await costCenters.create(ctxOf(erp), costCenterCreateSchema.parse(body)))),
				{
					erp: { permission: ['cost_center:create'] },
					detail: { description: 'Creates a cost centre' },
				},
			)
			.patch(
				'/cost-centers/:id',
				async ({ params, body, erp }) =>
					ok(
						await costCenters.update(
							ctxOf(erp),
							ledgerIdParamSchema.parse(params).id,
							costCenterUpdateSchema.parse(body),
						),
					),
				{
					erp: { permission: ['cost_center:update'] },
					detail: { description: 'Edits a cost centre' },
				},
			)
			.delete(
				'/cost-centers/:id',
				async ({ params, erp }) =>
					ok(await costCenters.archive(ctxOf(erp), ledgerIdParamSchema.parse(params).id)),
				{
					erp: { permission: ['cost_center:archive'] },
					detail: { description: 'Deactivates a cost centre (journal lines keep the reference)' },
				},
			)
			/* ---------------- posting rules ---------------- */
			.get(
				'/posting-rules',
				async ({ query, erp }) =>
					ok(await rules.list(erp.organizationId, postingRuleListQuerySchema.parse(query))),
				{
					erp: { permission: ['posting_rule:read'] },
					detail: { description: 'Account determination rules used by business-event postings' },
				},
			)
			.post(
				'/posting-rules',
				async ({ body, erp, status }) =>
					status(201, created(await rules.create(ctxOf(erp), postingRuleCreateSchema.parse(body)))),
				{
					erp: { permission: ['posting_rule:update'] },
					detail: { description: 'Adds a posting rule (event, role, optional discriminator -> account)' },
				},
			)
			.patch(
				'/posting-rules/:id',
				async ({ params, body, erp }) =>
					ok(
						await rules.update(
							ctxOf(erp),
							ledgerIdParamSchema.parse(params).id,
							postingRuleUpdateSchema.parse(body),
						),
					),
				{
					erp: { permission: ['posting_rule:update'] },
					detail: { description: 'Remaps a posting rule to another account or toggles it' },
				},
			)
			.delete(
				'/posting-rules/:id',
				async ({ params, erp }) =>
					ok(await rules.archive(ctxOf(erp), ledgerIdParamSchema.parse(params).id)),
				{
					erp: { permission: ['posting_rule:update'] },
					detail: { description: 'Archives a posting rule' },
				},
			);
	}
}
