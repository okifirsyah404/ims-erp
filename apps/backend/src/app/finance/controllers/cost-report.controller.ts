import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { container } from 'tsyringe';
import { z } from 'zod';
import type { ErpContext } from '@authorization/elysia-auth';
import { businessDateOf } from '@utils/business-date.util';
import { CASH_FORECAST_SERVICE_TOKEN, COST_REPORT_SERVICE_TOKEN, STATEMENT_SERVICE_TOKEN } from '../constants/di';
import { forecastLineSchema } from '../contracts/cash-forecast.contract';
import { statementQuerySchema } from '../contracts/statement.contract';
import { costReportQuerySchema } from '../contracts/cost-report.contract';

/**
 * Cost accounting reports (`/finance/reports/*`, ERP-0147): project job
 * costing and the cost-centre P&L, `financial_report:read`.
 */
export class CostReportController {
	static plugin() {
		const service = container.resolve(COST_REPORT_SERVICE_TOKEN);
		const statements = container.resolve(STATEMENT_SERVICE_TOKEN);
		const forecasts = container.resolve(CASH_FORECAST_SERVICE_TOKEN);
		const ctxOf = (erp: ErpContext) => ({ organizationId: erp.organizationId, actorUserId: erp.session.user.id });
		return domainPlugin({ name: 'finance-cost-reports', prefix: '/finance/reports', tags: ['Finance'], guards: 'erp' })
			.get(
				'/project-costing',
				async ({ query, erp }) => {
					const { from, to } = costReportQuerySchema.parse(query);
					return ok(await service.projectCosting(erp.organizationId, from, to));
				},
				{ erp: { permission: ['financial_report:read'] }, detail: { description: 'Revenue, cost, margin and budget per project for a date range' } },
			)
			.get(
				'/project-costing/:projectId',
				async ({ params, query, erp }) => {
					const { from, to } = costReportQuerySchema.parse(query);
					return ok(await service.projectDetail(erp.organizationId, z.object({ projectId: z.uuid() }).parse(params).projectId, from, to));
				},
				{ erp: { permission: ['financial_report:read'] }, detail: { description: "One project's revenue and cost per account" } },
			)
			.get(
				'/statements',
				async ({ query, erp }) => {
					const { from, to, compare } = statementQuerySchema.parse(query);
					return ok(await statements.statements(erp.organizationId, from, to, compare));
				},
				{
					erp: { permission: ['financial_report:read'] },
					detail: { description: 'Direct and indirect cash flow, changes in equity, with an optional comparative range (ERP-0148)' },
				},
			)
			.get('/cash-forecast', async ({ erp }) => ok(await forecasts.forecast(erp.organizationId, businessDateOf())), {
				erp: { permission: ['financial_report:read'] },
				detail: { description: '13-week cash forecast from today (ERP-0149)' },
			})
			.get(
				'/cash-forecast/lines',
				async ({ erp }) => {
					const today = businessDateOf();
					return ok(await forecasts.listLines(erp.organizationId, today, '9999-12-31'));
				},
				{ erp: { permission: ['financial_report:read'] }, detail: { description: 'Manual forecast lines from today' } },
			)
			.post('/cash-forecast/lines', async ({ body, erp }) => ok(await forecasts.addLine(ctxOf(erp), forecastLineSchema.parse(body))), {
				erp: { permission: ['cash_bank:create'] },
				detail: { description: 'Adds a manual expected receipt or payment' },
			})
			.delete(
				'/cash-forecast/lines/:id',
				async ({ params, erp }) => ok({ removed: await forecasts.removeLine(erp.organizationId, z.object({ id: z.uuid() }).parse(params).id) }),
				{ erp: { permission: ['cash_bank:create'] }, detail: { description: 'Removes a manual forecast line' } },
			)
			.get(
				'/cost-center-pl',
				async ({ query, erp }) => {
					const { from, to } = costReportQuerySchema.parse(query);
					return ok(await service.costCenterPl(erp.organizationId, from, to));
				},
				{ erp: { permission: ['financial_report:read'] }, detail: { description: 'Revenue, cost and result per cost centre for a date range' } },
			);
	}
}
