import type { ErpContext } from '@authorization/elysia-auth';
import { domainPlugin } from '@http/plugin';
import { created, ok } from '@http/response';
import { container } from 'tsyringe';
import { z } from 'zod';
import { PROJECT_BUDGET_SERVICE_TOKEN } from '../constants/di';
import { budgetCreateSchema, budgetLinesSchema, budgetModeSchema } from '../contracts/project-budget.contract';

const projectParam = z.object({ projectId: z.uuid() });
const idParam = z.object({ id: z.uuid() });

/**
 * Project budgets (`/finance/project-budgets`, ERP-0146). Reading needs
 * `project:read`; maintaining versions needs `journal:approve` (finance
 * controls the budget, like the other ledger approvals).
 */
export class ProjectBudgetController {
	static plugin() {
		const service = container.resolve(PROJECT_BUDGET_SERVICE_TOKEN);
		const ctxOf = (erp: ErpContext) => ({ organizationId: erp.organizationId, actorUserId: erp.session.user.id });

		return domainPlugin({ name: 'finance-project-budgets', prefix: '/finance/project-budgets', tags: ['Finance'], guards: 'erp' })
			.get('/check', async ({ query }) => {
				const input = z.object({ projectId: z.uuid(), amount: z.coerce.number().int().min(0) }).parse(query);
				return ok(await service.check({ ...input, amount: input.amount }).catch((error: Error) => ({ blocked: true, message: error.message })));
			}, { erp: { permission: ['project:read'] }, detail: { description: 'Whether an amount fits the project budget (UI pre-check)' } })
			.get('/projects/:projectId', async ({ params, erp }) => ok(await service.versions(erp.organizationId, projectParam.parse(params).projectId)), {
				erp: { permission: ['project:read'] },
				detail: { description: 'Budget versions of a project with their lines' },
			})
			.get('/projects/:projectId/report', async ({ params, erp }) => ok(await service.report(erp.organizationId, projectParam.parse(params).projectId)), {
				erp: { permission: ['project:read'] },
				detail: { description: 'Budget vs actual per account and month, commitment and totals' },
			})
			.post(
				'/projects/:projectId',
				async ({ params, body, erp, status }) =>
					status(201, created(await service.createVersion(ctxOf(erp), projectParam.parse(params).projectId, budgetCreateSchema.parse(body ?? {})))),
				{ erp: { permission: ['journal:approve'] }, detail: { description: 'Starts a draft budget version (copying the active one by default)' } },
			)
			.put('/:id/lines', async ({ params, body, erp }) => ok(await service.replaceLines(ctxOf(erp), idParam.parse(params).id, budgetLinesSchema.parse(body).lines)), {
				erp: { permission: ['journal:approve'] },
				detail: { description: 'Replaces the lines of a draft version' },
			})
			.post('/:id/activate', async ({ params, erp }) => ok(await service.activate(ctxOf(erp), idParam.parse(params).id)), {
				erp: { permission: ['journal:approve'] },
				detail: { description: 'Activates a draft version; the previous active one is superseded' },
			})
			.patch('/:id/mode', async ({ params, body, erp }) => ok(await service.setControlMode(ctxOf(erp), idParam.parse(params).id, budgetModeSchema.parse(body).controlMode)), {
				erp: { permission: ['journal:approve'] },
				detail: { description: 'warn or block' },
			});
	}
}
