import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import {
	expenseClaimCreateSchema,
	expenseClaimListQuerySchema,
	expenseClaimUpdateSchema,
} from '../contracts/expense.contract';
import { ledgerIdParamSchema } from '../contracts/ledger.contract';
import { EXPENSE_CLAIM_SERVICE_TOKEN } from '../constants/di';
import type { ExpenseClaimService } from '../services/expense-claim.service';

/**
 * REST controller for employee expense claims (ERP-0013).
 *
 * @remarks
 * The workflow is `draft → submitted → approved|rejected`, with
 * `cancelled` reachable from `draft`/`submitted`. `approve` is the ledger
 * event (`expense_claim:approve`); posting a claim is deferred, so `paid` is
 * never reached by these routes.
 */
export class ExpenseController {
	/** Builds the Elysia plugin mounting `/expenses*`. */
	static plugin() {
		const claims = container.resolve<ExpenseClaimService>(
			EXPENSE_CLAIM_SERVICE_TOKEN,
		);

		const ctxOf = (erp: ErpContext) => ({
			organizationId: erp.organizationId,
			actorUserId: erp.session.user.id,
		});

		return domainPlugin({
			name: 'expense-claims',
			prefix: '/finance',
			tags: ['Accounting'],
			guards: 'erp',
		})
			.get(
				'/expenses',
				async ({ query, erp }) =>
					okPaginated(
						await claims.list({
							organizationId: erp.organizationId,
							...expenseClaimListQuerySchema.parse(query),
						}),
					),
				{
					erp: { permission: ['expense_claim:read'] },
					detail: { description: 'Paginated employee expense claim list' },
				},
			)
			.get(
				'/expenses/:id',
				async ({ params, erp }) =>
					ok(
						await claims.detail(
							erp.organizationId,
							ledgerIdParamSchema.parse(params).id,
						),
					),
				{
					erp: { permission: ['expense_claim:read'] },
					detail: { description: 'One expense claim with its lines' },
				},
			)
			.post(
				'/expenses',
				async ({ body, erp, status }) =>
					status(
						201,
						created(
							await claims.create(
								ctxOf(erp),
								expenseClaimCreateSchema.parse(body),
							),
						),
					),
				{
					erp: { permission: ['expense_claim:create'] },
					detail: { description: 'Creates a draft expense claim with its lines' },
				},
			)
			.patch(
				'/expenses/:id',
				async ({ params, body, erp }) =>
					ok(
						await claims.update(
							ctxOf(erp),
							ledgerIdParamSchema.parse(params).id,
							expenseClaimUpdateSchema.parse(body),
						),
					),
				{
					erp: { permission: ['expense_claim:update'] },
					detail: { description: 'Edits a draft (or rejected) claim; lines are replaced' },
				},
			)
			.post(
				'/expenses/:id/submit',
				async ({ params, erp }) =>
					ok(await claims.submit(ctxOf(erp), ledgerIdParamSchema.parse(params).id)),
				{
					erp: { permission: ['expense_claim:submit'] },
					detail: { description: 'draft|rejected → submitted' },
				},
			)
			.post(
				'/expenses/:id/approve',
				async ({ params, erp }) =>
					ok(await claims.approve(ctxOf(erp), ledgerIdParamSchema.parse(params).id)),
				{
					erp: { permission: ['expense_claim:approve'] },
					detail: {
						description:
							'submitted → approved: posts DR expense (per category) / DR input tax / CR claims payable',
					},
				},
			)
			.post(
				'/expenses/:id/reject',
				async ({ params, erp }) =>
					ok(await claims.reject(ctxOf(erp), ledgerIdParamSchema.parse(params).id)),
				{
					erp: { permission: ['expense_claim:reject'] },
					detail: { description: 'submitted → rejected' },
				},
			)
			.post(
				'/expenses/:id/cancel',
				async ({ params, erp }) =>
					ok(await claims.cancel(ctxOf(erp), ledgerIdParamSchema.parse(params).id)),
				{
					erp: { permission: ['expense_claim:cancel'] },
					detail: { description: 'draft|submitted → cancelled (no journal impact)' },
				},
			);
	}
}
