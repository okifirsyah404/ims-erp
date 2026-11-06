/**
 * ERP-0036 one-shot cleanup: physical tools leave the inventory module.
 *
 * `inventory.items.item_kind` shrinks to `product|component|material` in the
 * same change, so every existing `tool`/`service` item (and the serialized
 * units that only existed so tools could be borrowed) must be gone before the
 * tightened CHECK is applied. This script does that removal and nothing else.
 *
 * DESTRUCTIVE. Accepted only because no production database exists. Run the
 * dry-run first; it prints the target database and every row class it would
 * touch, and refuses to write until `--apply` is passed.
 *
 * Refusals (before any write):
 * - a borrowing with lines both inside and outside the delete set — it cannot
 *   be cancelled without destroying a borrow of a still-valid item;
 * - a stock adjustment line against a tool or service item — adjustments are
 *   financial documents and are never deleted by this script.
 *
 * Usage:
 *   bun run database/cleanup-tool-items.ts            # dry run
 *   bun run database/cleanup-tool-items.ts --apply    # write
 */
import { SQL } from 'bun';
import pino from 'pino';
import { appConfig } from '../config/providers/config';

const APPLY = process.argv.includes('--apply');

const logger = pino({
	timestamp: false,
	formatters: { level: (label) => ({ level: label }) },
});

type TTarget = { id: string; sku: string; itemKind: string };

async function main(): Promise<void> {
	const sql = new SQL(appConfig.database.url!);
	const [target] = await sql<{ db: string; host: string }[]>`
		select current_database() as db,
		       coalesce(inet_server_addr()::text, 'local') as host
	`;
	logger.info(
		{ database: target.db, host: target.host },
		'ERP-0036 cleanup target',
	);

	try {
		const items = await sql<TTarget[]>`
			select id, sku, item_kind as "itemKind"
			from inventory.items
			where item_kind in ('tool', 'service')
			order by sku
		`;
		const itemIds = items.map((item) => item.id);

		if (itemIds.length === 0) {
			logger.info('No tool/service items. Nothing to do.');
			return;
		}

		const units = await sql<{ id: string }[]>`
			select id from inventory.serial_tracked_items
			where item_id = any(${itemIds}::uuid[])
		`;
		const unitIds = units.map((unit) => unit.id);

		// A borrowing is cancellable only when every one of its lines points
		// at a unit that is going away.
		const affected = await sql<
			{
				borrowingId: string;
				code: string;
				status: string;
				lineCount: number;
				foreignLineCount: number;
			}[]
		>`
			select b.id as "borrowingId", b.code, b.status,
			       count(l.id)::int as "lineCount",
			       count(l.id) filter (
			         where not (l.serial_tracked_item_id = any(${unitIds}::uuid[]))
			       )::int as "foreignLineCount"
			from inventory.borrowings b
			join inventory.borrowing_lines l on l.borrowing_id = b.id
			where l.serial_tracked_item_id = any(${unitIds}::uuid[])
			group by b.id, b.code, b.status
			order by b.code
		`;

		const unclassifiable = affected.filter((row) => row.foreignLineCount > 0);
		if (unclassifiable.length > 0) {
			throw new Error(
				`Refusing: borrowing(s) mix tool/service and other items: ${unclassifiable
					.map((row) => `${row.code} (${row.foreignLineCount} foreign line(s))`)
					.join(', ')}`,
			);
		}

		const adjustmentLines = (
			await sql<{ n: number }[]>`
				select count(*)::int n from inventory.stock_adjustment_items
				where item_id = any(${itemIds}::uuid[])
			`
		)[0]!.n;
		if (adjustmentLines > 0) {
			throw new Error(
				`Refusing: ${adjustmentLines} stock adjustment line(s) reference tool/service items. Resolve manually.`,
			);
		}

		const summary = {
			items: items.length,
			byKind: items.reduce<Record<string, number>>((acc, item) => {
				acc[item.itemKind] = (acc[item.itemKind] ?? 0) + 1;
				return acc;
			}, {}),
			units: unitIds.length,
			borrowings: affected.length,
			openBorrowings: affected.filter(
				(row) => row.status !== 'closed' && row.status !== 'cancelled',
			).length,
			stockMovements: (
				await sql<{ n: number }[]>`
					select count(*)::int n from inventory.stock_movements
					where item_id = any(${itemIds}::uuid[])
				`
			)[0]!.n,
			stockBalances: (
				await sql<{ n: number }[]>`
					select count(*)::int n from inventory.stock_balances
					where item_id = any(${itemIds}::uuid[])
				`
			)[0]!.n,
		};

		logger.info(
			summary,
			APPLY ? 'Applying cleanup' : 'Dry run — pass --apply to write',
		);

		if (!APPLY) {
			logger.info('Dry run complete. Nothing was written.');
			return;
		}

		const borrowingIds = affected.map((row) => row.borrowingId);

		await sql.begin(async (tx) => {
			const now = Date.now();

			for (const row of affected) {
				await tx`
					update inventory.borrowings
					set status = 'cancelled', closed_at = ${now}, updated_at = ${now}
					where id = ${row.borrowingId}
				`;
				await tx`
					insert into inventory.borrowing_events
						(borrowing_id, event_type, occurred_at, note)
					values (${row.borrowingId}, 'cancelled', ${now},
					        'ERP-0036 cleanup: tool items moved to assets')
				`;
				await tx`
					insert into audit.audit_logs
						(id, actor_user_id, action, target_type, target_id, organization_id, meta, created_at)
					select uuidv7()::text, 'system:erp-0036-cleanup', 'borrowing.cancelled',
					       'borrowing', ${row.borrowingId}, organization_id,
					       ${JSON.stringify({ reason: 'ERP-0036 cleanup', code: row.code, previousStatus: row.status })}::jsonb,
					       ${now}
					from inventory.borrowings where id = ${row.borrowingId}
				`;
			}

			// Break the serial_tracked_items <-> borrowing_lines cycle before
			// deleting either side.
			await tx`
				update inventory.serial_tracked_items
				set current_borrowing_line_id = null
				where item_id = any(${itemIds}::uuid[])
			`;
			await tx`
				delete from inventory.borrowing_events
				where borrowing_id = any(${borrowingIds}::uuid[])
			`;
			await tx`
				delete from inventory.borrowing_lines
				where borrowing_id = any(${borrowingIds}::uuid[])
			`;
			await tx`
				delete from inventory.borrowings
				where id = any(${borrowingIds}::uuid[])
			`;

			// The ledger and its projection point at the item with ON DELETE
			// RESTRICT: the rows cannot outlive the item master they describe.
			await tx`
				delete from inventory.stock_balances
				where item_id = any(${itemIds}::uuid[])
			`;
			await tx`
				delete from inventory.stock_movements
				where item_id = any(${itemIds}::uuid[])
			`;
			await tx`
				delete from inventory.serial_tracked_items
				where item_id = any(${itemIds}::uuid[])
			`;
			await tx`
				delete from inventory.items
				where id = any(${itemIds}::uuid[])
			`;

			await tx`
				insert into audit.audit_logs
					(id, actor_user_id, action, target_type, target_id, meta, created_at)
				values (uuidv7()::text, 'system:erp-0036-cleanup', 'item.archived',
				        'item', 'erp-0036-cleanup',
				        ${JSON.stringify({ ...summary, skus: items.map((item) => item.sku) })}::jsonb,
				        ${now})
			`;
		});

		logger.info('Cleanup applied.');
	} finally {
		await sql.close();
	}
}

main().catch((error) => {
	logger.error({ err: error }, 'ERP-0036 cleanup failed');
	process.exit(1);
});
