import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { container } from 'tsyringe';
import { z } from 'zod';
import { COST_REPORT_SERVICE_TOKEN, STATEMENT_SERVICE_TOKEN } from '../constants/di';
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
