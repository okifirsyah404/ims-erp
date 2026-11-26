import { DRIZZLE_TOKEN } from '@di/provider';
import { chartOfAccounts, costCenters, journalEntries, journalLines } from '@drizzle/schemas/finance.schema';
import { and, eq, gte, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { ICostReportRepository } from '../contracts/cost-report.contract';

const POSTED = ['posted', 'reversed'];
/** Revenue is credit - debit, cost is debit - credit, both from journal lines. */
const revenue = sql<string>`coalesce(sum(case when ${chartOfAccounts.accountType} = 'revenue' then ${journalLines.credit} - ${journalLines.debit} else 0 end), 0)`;
const cost = sql<string>`coalesce(sum(case when ${chartOfAccounts.accountType} = 'expense' then ${journalLines.debit} - ${journalLines.credit} else 0 end), 0)`;

/**
 * Cost-accounting aggregates over posted journal lines (ERP-0147). Reversed
 * entries are included because their reversal entry nets them out.
 */
@injectable()
export class CostReportRepository implements ICostReportRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	private range(organizationId: string, from: string, to: string) {
		return and(
			eq(journalEntries.organizationId, organizationId),
			inArray(journalEntries.status, POSTED),
			gte(journalEntries.entryDate, from),
			lte(journalEntries.entryDate, to),
		);
	}

	async byProject(organizationId: string, from: string, to: string) {
		const rows = await this.database
			.select({ projectId: journalLines.projectId, revenue, cost })
			.from(journalLines)
			.innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
			.innerJoin(chartOfAccounts, eq(chartOfAccounts.id, journalLines.accountId))
			.where(and(this.range(organizationId, from, to), isNotNull(journalLines.projectId)))
			.groupBy(journalLines.projectId);
		return rows.map((row) => ({ projectId: row.projectId as string, revenue: Number(row.revenue), cost: Number(row.cost) }));
	}

	async projectAccounts(organizationId: string, projectId: string, from: string, to: string) {
		const rows = await this.database
			.select({
				accountId: chartOfAccounts.id,
				code: chartOfAccounts.code,
				name: chartOfAccounts.name,
				accountType: chartOfAccounts.accountType,
				amount: sql<string>`sum(case when ${chartOfAccounts.accountType} = 'revenue' then ${journalLines.credit} - ${journalLines.debit} else ${journalLines.debit} - ${journalLines.credit} end)`,
			})
			.from(journalLines)
			.innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
			.innerJoin(chartOfAccounts, eq(chartOfAccounts.id, journalLines.accountId))
			.where(
				and(
					this.range(organizationId, from, to),
					eq(journalLines.projectId, projectId),
					inArray(chartOfAccounts.accountType, ['revenue', 'expense']),
				),
			)
			.groupBy(chartOfAccounts.id, chartOfAccounts.code, chartOfAccounts.name, chartOfAccounts.accountType)
			.orderBy(chartOfAccounts.code);
		return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
	}

	async byDimension(organizationId: string, from: string, to: string, dimension: 'project' | 'customer' | 'product') {
		const column =
			dimension === 'project'
				? journalLines.projectId
				: dimension === 'product'
					? journalLines.productId
					: sql<string | null>`case when ${journalLines.partyType} = 'customer' then ${journalLines.partyId} else null end`;
		const rows = await this.database
			.select({ key: sql<string | null>`${column}`, revenue, cost })
			.from(journalLines)
			.innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
			.innerJoin(chartOfAccounts, eq(chartOfAccounts.id, journalLines.accountId))
			.where(and(this.range(organizationId, from, to), inArray(chartOfAccounts.accountType, ['revenue', 'expense'])))
			.groupBy(sql`1`);
		return rows.map((row) => ({ key: row.key ? String(row.key) : null, revenue: Number(row.revenue), cost: Number(row.cost) }));
	}

	async byCostCenter(organizationId: string, from: string, to: string) {
		const rows = await this.database
			.select({ costCenterId: journalLines.costCenterId, code: costCenters.code, name: costCenters.name, revenue, cost })
			.from(journalLines)
			.innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
			.innerJoin(chartOfAccounts, eq(chartOfAccounts.id, journalLines.accountId))
			.leftJoin(costCenters, eq(costCenters.id, journalLines.costCenterId))
			.where(and(this.range(organizationId, from, to), inArray(chartOfAccounts.accountType, ['revenue', 'expense'])))
			.groupBy(journalLines.costCenterId, costCenters.code, costCenters.name);
		return rows.map((row) => ({
			costCenterId: row.costCenterId,
			code: row.code,
			name: row.name,
			revenue: Number(row.revenue),
			cost: Number(row.cost),
		}));
	}
}
