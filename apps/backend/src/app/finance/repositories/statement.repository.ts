import { DRIZZLE_TOKEN } from '@di/provider';
import { bankAccountLinks, chartOfAccounts, journalEntries, journalLines } from '@drizzle/schemas/finance.schema';
import { and, eq, exists, gte, inArray, isNull, like, lte, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IStatementRepository } from '../contracts/statement.contract';

const POSTED = ['posted', 'reversed'];

/** Reads for the ERP-0148 statements; finance-owned tables only. */
@injectable()
export class StatementRepository implements IStatementRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	/** Postable 1-11xx accounts (Kas dan Setara Kas) plus GL accounts linked to a cash/bank account. */
	async cashAccountIds(organizationId: string): Promise<string[]> {
		const byCode = await this.database
			.select({ id: chartOfAccounts.id })
			.from(chartOfAccounts)
			.where(and(eq(chartOfAccounts.organizationId, organizationId), like(chartOfAccounts.code, '1-11%'), eq(chartOfAccounts.isPostable, true)));
		const linked = await this.database
			.select({ id: bankAccountLinks.chartOfAccountId })
			.from(bankAccountLinks)
			.where(and(eq(bankAccountLinks.organizationId, organizationId), isNull(bankAccountLinks.deletedAt)));
		return [...new Set([...byCode.map((row) => row.id), ...linked.map((row) => row.id as string)])];
	}

	/**
	 * Non-cash lines of every posted entry in the range that touches a cash
	 * account, netted per account: in a balanced entry their credit - debit
	 * is exactly the cash they moved.
	 */
	async cashCounterparts(organizationId: string, cashAccountIds: string[], from: string, to: string) {
		if (cashAccountIds.length === 0) return [];
		const cashLine = alias(journalLines, 'cash_line');
		const rows = await this.database
			.select({
				accountId: journalLines.accountId,
				inflow: sql<string>`sum(${journalLines.credit} - ${journalLines.debit})`,
			})
			.from(journalLines)
			.innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
			.where(
				and(
					eq(journalEntries.organizationId, organizationId),
					inArray(journalEntries.status, POSTED),
					gte(journalEntries.entryDate, from),
					lte(journalEntries.entryDate, to),
					sql`${journalLines.accountId} not in (${sql.join(cashAccountIds.map((id) => sql`${id}`), sql`, `)})`,
					exists(
						this.database
							.select({ one: sql`1` })
							.from(cashLine)
							.where(and(eq(cashLine.journalEntryId, journalEntries.id), inArray(cashLine.accountId, cashAccountIds))),
					),
				),
			)
			.groupBy(journalLines.accountId);
		return rows.map((row) => ({ accountId: row.accountId, inflow: Number(row.inflow) })).filter((row) => row.inflow !== 0);
	}

	/** Debit and credit per account for posted entries dated within the range. */
	async activity(organizationId: string, from: string, to: string) {
		const rows = await this.database
			.select({
				accountId: journalLines.accountId,
				debit: sql<string>`sum(${journalLines.debit})`,
				credit: sql<string>`sum(${journalLines.credit})`,
			})
			.from(journalLines)
			.innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
			.where(
				and(
					eq(journalEntries.organizationId, organizationId),
					inArray(journalEntries.status, POSTED),
					gte(journalEntries.entryDate, from),
					lte(journalEntries.entryDate, to),
				),
			)
			.groupBy(journalLines.accountId);
		return rows.map((row) => ({ accountId: row.accountId, debit: Number(row.debit), credit: Number(row.credit) }));
	}
}
