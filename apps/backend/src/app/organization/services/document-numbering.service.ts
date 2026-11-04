import { DRIZZLE_TOKEN } from '@di/provider';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import type { TTx } from '@drizzle/types';

/**
 * ERP-0009 document numbering service.
 *
 * @remarks
 * **The numbering authority** per `docs/database/module-ownership.md` §3:
 * `organization.document_sequences` owns per-organization, per-document-type
 * number allocation; every module that mints document codes calls this
 * service instead of inventing its own scheme.
 *
 * **Allocation is one statement, inside the caller's transaction:**
 *
 * ```
 * INSERT INTO organization.document_sequences (organization_id, doc_type, next_number)
 * VALUES (?, ?, 2)
 * ON CONFLICT (organization_id, doc_type)
 * DO UPDATE SET next_number = document_sequences.next_number + 1
 * RETURNING next_number - 1 AS allocated
 * ```
 *
 * The upsert lazily seeds the row on first use and — because
 * `ON CONFLICT … DO UPDATE` locks the conflicting row — serializes two
 * concurrent allocations on the same sequence row. Allocation always happens
 * inside the *document's own transaction*, so a rollback releases the number
 * (gap) but never duplicates it: numbers are strictly unique per
 * `(organization, doc_type)`, gaps are acceptable (hardening plan D4).
 */
@injectable()
export class DocumentNumberingService {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	/**
	 * Allocates the next number for `(organizationId, docType)`.
	 *
	 * @param organizationId - Owning organization; `null` = shared/global
	 *   documents, keyed under the empty string (a global warehouse's
	 *   movements and borrowings carry `organization_id IS NULL`, so their
	 *   sequence is shared too — same convention as the balance scope rule)
	 * @param docType - Document family key (stable, e.g. `stock_movement`)
	 * @param tx - The document's transaction; allocation commits with it.
	 *   Passing no transaction is allowed for scripts/seeders and allocates
	 *   in its own implicit transaction.
	 * @returns The allocated number (monotonic per sequence, starts at 1)
	 */
	async allocate(
		organizationId: string | null,
		docType: string,
		tx?: TTx,
	): Promise<number> {
		// Single round trip: lazy seed + row lock + allocation.
		const [row] = await (tx ?? this.database)
			.execute(sql`
				INSERT INTO organization.document_sequences
					(organization_id, doc_type, next_number, created_at)
				VALUES (${organizationId ?? ''}, ${docType}, 2, ${new Date()})
				ON CONFLICT (organization_id, doc_type)
				DO UPDATE SET next_number = organization.document_sequences.next_number + 1
				RETURNING next_number - 1 AS allocated
			`)
			.then(
				(
					result,
				) => (result as unknown as { rows: Array<{ allocated: number }> })
					.rows,
			);

		return row.allocated;
	}

	/**
	 * Mints a full document code from an allocated number.
	 *
	 * @remarks
	 * Pure helper so every domain keeps its own human-readable format while
	 * the *serial part* is always sequence-allocated:
	 * - stock movements: `MV-<YYYYMMDDHHMMSS>-<#6>`
	 * - adjustments: `ADJ-<YYYYMMDDHHMMSS>-<#4>`
	 * - borrowings: `BRW-<YYYYMM>-<#4>`
	 */
	format(prefix: string, middle: string, number: number, pad = 6): string {
		return `${prefix}-${middle}-${String(number).padStart(pad, '0')}`;
	}
}
