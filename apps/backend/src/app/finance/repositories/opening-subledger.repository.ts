import { DRIZZLE_TOKEN } from '@di/provider';
import { openingSubledgerItems, type TOpeningSubledgerItemSelect } from '@drizzle/schemas/finance.schema';
import type { TTx } from '@drizzle/types';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IOpeningSubledgerRepository, TOpeningSubledgerRow, TSubledger } from '../contracts/opening-subledger.contract';

/** Drizzle implementation of {@link IOpeningSubledgerRepository} (ERP-0142). */
@injectable()
export class OpeningSubledgerRepository implements IOpeningSubledgerRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	list(organizationId: string, ledger?: TSubledger): Promise<TOpeningSubledgerItemSelect[]> {
		return this.database
			.select()
			.from(openingSubledgerItems)
			.where(
				and(
					eq(openingSubledgerItems.organizationId, organizationId),
					isNull(openingSubledgerItems.deletedAt),
					ledger ? eq(openingSubledgerItems.ledger, ledger) : undefined,
				),
			)
			.orderBy(asc(openingSubledgerItems.ledger), asc(openingSubledgerItems.partyCode), asc(openingSubledgerItems.documentNumber));
	}

	async replaceDrafts(
		organizationId: string,
		ledger: TSubledger,
		asOfDate: string,
		createdBy: string,
		rows: TOpeningSubledgerRow[],
		tx?: TTx,
	): Promise<void> {
		const db = tx ?? this.database;
		const now = new Date();
		await db
			.update(openingSubledgerItems)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(openingSubledgerItems.organizationId, organizationId),
					eq(openingSubledgerItems.ledger, ledger),
					isNull(openingSubledgerItems.postedAt),
					isNull(openingSubledgerItems.deletedAt),
				),
			);
		if (rows.length === 0) return;
		await db.insert(openingSubledgerItems).values(
			rows.map((row) => ({ ...row, organizationId, ledger, asOfDate, createdBy, currencyCode: 'IDR', createdAt: now, updatedAt: now })),
		);
	}

	async discardDrafts(organizationId: string, ledger: TSubledger): Promise<number> {
		const now = new Date();
		const removed = await this.database
			.update(openingSubledgerItems)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(openingSubledgerItems.organizationId, organizationId),
					eq(openingSubledgerItems.ledger, ledger),
					isNull(openingSubledgerItems.postedAt),
					isNull(openingSubledgerItems.deletedAt),
				),
			)
			.returning({ id: openingSubledgerItems.id });
		return removed.length;
	}

	async markPosted(
		organizationId: string,
		id: string,
		links: { arOpenItemId?: string; supplierBillId?: string; apOpenItemId?: string },
		tx?: TTx,
	): Promise<void> {
		const now = new Date();
		await (tx ?? this.database)
			.update(openingSubledgerItems)
			.set({ ...links, postedAt: now, updatedAt: now })
			.where(and(eq(openingSubledgerItems.organizationId, organizationId), eq(openingSubledgerItems.id, id)));
	}
}
