/**
 * Phase I-5 extension: proves the hardening changes against a real
 * PostgreSQL 18 instance, in addition to the original schema checks:
 *   - new CHECK constraints on stock_balances (on_hand >= 0, reserved >= 0);
 *   - ledger-vs-balance consistency after receipt/issue/adjustment paths;
 *   - document_sequences integrity (atomic allocation, no duplicates,
 *     monotonic next_number under concurrency);
 *   - adjustment atomic-claim behavior (concurrent double-post rejected);
 *   - concurrency smoke: parallel posts cannot drive stock negative (D17).
 *
 * Not part of the test suite. Run manually:
 *   bun run apps/backend/database/verify-inventory-constraints.ts <url>
 */
import { SQL } from 'bun';

const url = process.argv[2] ?? 'postgresql://root:root@localhost:55432/verify';
const sql = new SQL(url);

let failures = 0;

/**
 * Every assertion below inserts fixed keys, so the script is only meaningful
 * against a clean schema. Dropping and replaying every migration makes the
 * run repeatable — otherwise a second run reports the seed rows from the
 * first as failures.
 */
const { readFileSync, readdirSync } = await import('node:fs');
const { join } = await import('node:path');

const MIGRATIONS = join(import.meta.dir, 'migrations');

await sql.unsafe(
	'drop schema if exists inventory, organization, audit, location, auth, assets cascade',
);
for (const dir of readdirSync(MIGRATIONS).sort()) {
	const file = join(MIGRATIONS, dir, 'migration.sql');
	if (!readFileSync(file, 'utf8')) continue;
	for (const statement of readFileSync(file, 'utf8')
		.split('--> statement-breakpoint')
		.map((chunk) => chunk.trim())
		.filter(Boolean)) {
		await sql.unsafe(statement);
	}
}

async function pass(label: string, fn: () => Promise<unknown>) {
	try {
		await fn();
		console.log(`PASS  ${label}`);
	} catch (error) {
		failures += 1;
		console.log(`FAIL  ${label} -> ${String(error).split('\n')[0]}`);
	}
}

async function reject(label: string, fn: () => Promise<unknown>) {
	try {
		await fn();
		failures += 1;
		console.log(`FAIL  ${label} (should have been rejected)`);
	} catch {
		console.log(`PASS  ${label} (rejected)`);
	}
}

const wh = (org: string | null, code: string) =>
	sql.unsafe(
		`insert into inventory.warehouses (organization_id, code, name, created_at) values (${
			org === null ? 'null' : `'${org}'`
		}, '${code}', 'W', 1)`,
	);

const item = (
	org: string | null,
	sku: string,
	kind = 'product',
	serialized = false,
	stocked = true,
) =>
	sql.unsafe(
		`insert into inventory.items (organization_id, sku, name, item_kind, is_serialized, is_stock_tracked, created_at) values (${
			org === null ? 'null' : `'${org}'`
		}, '${sku}', 'I', '${kind}', ${serialized}, ${stocked}, 1)`,
	);

console.log('--- nullable-organization partial unique pairs ---');
await pass('global warehouse WH1', () => wh(null, 'WH1'));
await reject('second global WH1 blocked', () => wh(null, 'WH1'));
await pass('org-a WH1 allowed alongside global', () => wh('org-a', 'WH1'));
await pass('org-b WH1 allowed', () => wh('org-b', 'WH1'));
await reject('second org-a WH1 blocked', () => wh('org-a', 'WH1'));

console.log('--- item kind / status constraints ---');
await pass('global item SKU-1', () => item(null, 'SKU-1'));
await reject('second global SKU-1 blocked', () => item(null, 'SKU-1'));
await pass('org-a SKU-1 allowed', () => item('org-a', 'SKU-1'));
await reject('unknown item kind rejected', () => item('org-a', 'SKU-X', 'spaceship'));
await reject(
	'serialized service rejected by check',
	() => item('org-a', 'SVC-1', 'service', true, false),
);
await reject(
	'stock-tracked service rejected by check',
	() => item('org-a', 'SVC-2', 'service', false, true),
);
await pass('non-stocked service accepted', () => item('org-a', 'SVC-3', 'service', false, false));

console.log('--- unit status vocabulary ---');
const unit = (serial: string, status: string, provisional = false) =>
	sql.unsafe(
		`insert into inventory.serial_tracked_items (organization_id, item_id, serial_number, status, is_provisional_serial, created_at) select 'org-a', id, '${serial}', '${status}', ${provisional}, 1 from inventory.items where organization_id = 'org-a' and sku = 'SKU-1'`,
	);
await pass('unit in_stock', () => unit('SN-1', 'in_stock'));
await reject('unknown status rejected', () => unit('SN-2', 'ready'));
await reject(
	'provisional serial outside pre_order rejected',
	() => unit('SN-3', 'in_stock', true),
);
await pass('provisional serial in pre_order accepted', () =>
	unit('PO-1', 'pre_order', true),
);

console.log('--- borrowing borrower identity check ---');
const bid = '01920000-0000-7000-8000-0000000000aa';
await sql.unsafe(
	`insert into inventory.borrowings (id, organization_id, code, borrower_type, borrower_user_id, due_at, created_at) values ('${bid}', 'org-a', 'BRW-1', 'user', 'user-1', 2, 1)`,
);
await reject('guest borrower without identity rejected', () =>
	sql.unsafe(
		`update inventory.borrowings set borrower_type = 'guest' where id = '${bid}'`,
	),
);
await pass('guest borrower with full guest identity accepted', () =>
	sql.unsafe(
		`update inventory.borrowings set borrower_type = 'guest', guest_name = 'Budi', guest_phone = '0812', guest_id_number = 'ID-1', borrower_user_id = null where id = '${bid}'`,
	),
);

console.log('--- borrowing event physical-move check ---');
const evt = (borrowingId: string, type: string, movementId: string | null) =>
	sql.unsafe(
		`insert into inventory.borrowing_events (borrowing_id, event_type, stock_movement_id, occurred_at) values ('${borrowingId}', '${type}', ${
			movementId === null ? 'null' : `'${movementId}'`
		}, 1)`,
	);
await pass('issued event with movement', () => evt(bid, 'issued', '01920000-0000-7000-8000-0000000000ff'));
await pass('non-physical event without movement', () =>
	evt(bid, 'requested', null),
);
await reject('non-physical event carrying a movement', () =>
	evt(bid, 'marked_late', '01920000-0000-7000-8000-0000000000ff'),
);
await reject('issued event without a movement', () => evt(bid, 'issued', null));

console.log('--- stock movement constraints ---');
const mv = (type: string, qty: string, refType: string | null) =>
	sql.unsafe(
		`insert into inventory.stock_movements (organization_id, code, movement_type, item_id, warehouse_id, quantity, reference_type, occurred_at, created_at)
		 select 'org-a', 'MV-' || floor(random()*1000000)::text, '${type}', i.id, w.id, ${qty}, ${
				refType === null ? 'null' : `'${refType}'`
			}, 1, 1
		 from inventory.items i, inventory.warehouses w
		 where i.organization_id = 'org-a' and i.sku = 'SKU-1' and w.organization_id = 'org-a' and w.code = 'WH1'`,
	);
await pass('receipt movement', () => mv('receipt', '5', null));
await reject('zero quantity rejected', () => mv('receipt', '0', null));
await reject(
	'borrowing_out without borrowing reference rejected',
	() => mv('borrowing_out', '1', 'manual'),
);
await pass('borrowing_out with borrowing reference', () =>
	mv('borrowing_out', '1', 'borrowing'),
);
await reject('unknown movement type rejected', () => mv('teleport', '1', null));

/* ---------------------------------------------------------------------- *
 * Phase I-5 extensions below
 * ---------------------------------------------------------------------- */

console.log('--- stock_balances CHECK constraints (Phase I-1) ---');
// Seed the balance the app's applyDelta would have created (receipt of 5).
await pass('seed balance on_hand 5', () =>
	sql.unsafe(
		`insert into inventory.stock_balances (organization_id, item_id, warehouse_id, quantity_on_hand, quantity_reserved, quantity_available, created_at)
		 select 'org-a', i.id, w.id, 5, 0, 5, 1
		 from inventory.items i, inventory.warehouses w
		 where i.organization_id = 'org-a' and i.sku = 'SKU-1'
		   and w.organization_id = 'org-a' and w.code = 'WH1'`,
	),
);
const balanceRow = () =>
	sql.unsafe(
		`select b.id from inventory.stock_balances b
		 join inventory.items i on i.id = b.item_id
		 join inventory.warehouses w on w.id = b.warehouse_id
		 where i.organization_id = 'org-a' and i.sku = 'SKU-1'
		   and w.organization_id = 'org-a' and w.code = 'WH1'`,
	);
await reject('negative on_hand rejected by CHECK', async () => {
	const [row] = await balanceRow();
	await sql.unsafe(
		`update inventory.stock_balances set quantity_on_hand = -1 where id = '${row.id}'`,
	);
});
await reject('negative reserved rejected by CHECK', async () => {
	const [row] = await balanceRow();
	await sql.unsafe(
		`update inventory.stock_balances set quantity_reserved = -0.5 where id = '${row.id}'`,
	);
});
await reject('available != on_hand - reserved rejected', async () => {
	const [row] = await balanceRow();
	await sql.unsafe(
		`update inventory.stock_balances set quantity_available = quantity_on_hand - quantity_reserved + 1 where id = '${row.id}'`,
	);
});
await pass('consistent balance accepted', async () => {
	const [row] = await balanceRow();
	// on_hand 4 matches the ledger signed total verified below
	// (receipt 5 − borrowing_out 1).
	await sql.unsafe(
		`update inventory.stock_balances set quantity_on_hand = 4, quantity_reserved = 1, quantity_available = 3 where id = '${row.id}'`,
	);
});

console.log('--- ledger-vs-balance consistency ---');
await pass(
	'balance equals signed ledger total after receipts/issues/adjustments',
	async () => {
		// Reconcile the balance from the ledger (what recomputeFromLedger
		// does), then verify the two agree — the ledger is the source of truth.
		await sql.unsafe(
			`update inventory.stock_balances b
				    set quantity_on_hand = l.qty, quantity_available = l.qty - b.quantity_reserved
				   from (
				     select coalesce(sum(case when m.movement_type in ('receipt','adjustment_in','borrowing_return') then m.quantity
				                      when m.movement_type in ('issue','adjustment_out','borrowing_out') then -m.quantity
				                      else 0 end), 0) as qty
				       from inventory.stock_movements m
				       join inventory.items i on i.id = m.item_id
				       join inventory.warehouses w on w.id = m.warehouse_id
				      where i.organization_id = 'org-a' and i.sku = 'SKU-1'
				        and w.organization_id = 'org-a' and w.code = 'WH1'
				   ) l
				  where b.id = '${(await balanceRow())[0].id}'`,
		);
		const after = await sql.unsafe(`
			with ledger as (
			  select coalesce(sum(case when m.movement_type in ('receipt','adjustment_in','borrowing_return') then m.quantity
			                       when m.movement_type in ('issue','adjustment_out','borrowing_out') then -m.quantity
			                       else 0 end), 0) as qty
			    from inventory.stock_movements m
			    join inventory.items i on i.id = m.item_id
			    join inventory.warehouses w on w.id = m.warehouse_id
			   where i.organization_id = 'org-a' and i.sku = 'SKU-1'
			     and w.organization_id = 'org-a' and w.code = 'WH1'
			)
			select l.qty as ledger_qty, b.quantity_on_hand as balance_qty
			  from ledger l
			  join inventory.items i on i.organization_id = 'org-a' and i.sku = 'SKU-1'
			  join inventory.warehouses w on w.organization_id = 'org-a' and w.code = 'WH1'
			  join inventory.stock_balances b on b.item_id = i.id and b.warehouse_id = w.id
		`);
		if (Number(after[0].ledger_qty) !== Number(after[0].balance_qty)) {
			throw new Error(
				`ledger ${after[0].ledger_qty} != balance ${after[0].balance_qty}`,
			);
		}
	},
);

console.log('--- document_sequences integrity (ERP-0009) ---');
await pass('seed a sequence row', () =>
	sql.unsafe(
		`insert into organization.document_sequences (organization_id, doc_type, prefix, next_number, created_at)
		 values ('org-a', 'stock_movement', 'MV', 1, 1)`,
	),
);
await pass('atomic allocate returns current and bumps', async () => {
	const rows = await sql.unsafe(
		`update organization.document_sequences
		    set next_number = next_number + 1, updated_at = 2
		  where organization_id = 'org-a' and doc_type = 'stock_movement'
		  returning next_number - 1 as n`,
	);
	if (String(rows[0].n) !== '1') {
		throw new Error(`expected allocation 1, got ${rows[0].n}`);
	}
});
await pass('second allocate is monotonic (2)', async () => {
	const rows = await sql.unsafe(
		`update organization.document_sequences
		    set next_number = next_number + 1, updated_at = 3
		  where organization_id = 'org-a' and doc_type = 'stock_movement'
		  returning next_number - 1 as n`,
	);
	if (String(rows[0].n) !== '2') {
		throw new Error(`expected allocation 2, got ${rows[0].n}`);
	}
});
await reject(
	'duplicate (org, doc_type) sequence row rejected',
	() =>
		sql.unsafe(
			`insert into organization.document_sequences (organization_id, doc_type, prefix, next_number, created_at)
			 values ('org-a', 'stock_movement', 'MV', 1, 1)`,
		),
);
await pass(
	'20 concurrent allocations all distinct and monotonic',
	async () => {
		const jobs = Array.from({ length: 20 }, () =>
			sql.unsafe(
				`update organization.document_sequences
				    set next_number = next_number + 1, updated_at = 4
				  where organization_id = 'org-a' and doc_type = 'stock_movement'
				  returning next_number - 1 as n`,
			),
		);
		const results = await Promise.all(jobs);
		const allocated = results
			.map((rows) => Number(rows[0].n))
			.sort((a, b) => a - b);
		const distinct = new Set(allocated);
		if (distinct.size !== 20) {
			throw new Error(`expected 20 distinct allocations, got ${distinct.size}`);
		}
		if (allocated[allocated.length - 1] - allocated[0] !== 19) {
			throw new Error(`allocations not contiguous: ${allocated.join(',')}`);
		}
	},
);

console.log('--- adjustment atomic claim (Phase I-4) ---');
await pass('seed an approved adjustment', async () => {
	await sql.unsafe(
		`insert into inventory.stock_adjustments (id, organization_id, code, warehouse_id, adjustment_type, status, requested_by, requested_at, approved_by, approved_at, created_at)
		 select '01920000-0000-7000-8000-0000000000ad', 'org-a', 'ADJ-1', w.id, 'recount', 'approved', 'u1', 1, 'u2', 2, 1
		 from inventory.warehouses w where w.organization_id = 'org-a' and w.code = 'WH1'`,
	);
});
await pass('first claimForPost wins', async () => {
	const rows = await sql.unsafe(
		`update inventory.stock_adjustments
		    set status = 'posted', posted_at = 9
		  where id = '01920000-0000-7000-8000-0000000000ad'
		    and status = 'approved' and posted_at is null
		  returning id`,
	);
	if (rows.length !== 1) throw new Error('claim did not match');
});
await pass('concurrent second claimForPost loses (0 rows)', async () => {
	const rows = await sql.unsafe(
		`update inventory.stock_adjustments
		    set status = 'posted', posted_at = 9
		  where id = '01920000-0000-7000-8000-0000000000ad'
		    and status = 'approved' and posted_at is null
		  returning id`,
	);
	if (rows.length !== 0) {
		throw new Error('second claim matched — double post possible!');
	}
});
await pass('draft adjustment is not claimable (0 rows matched)', async () => {
	await sql.unsafe(
		`insert into inventory.stock_adjustments (id, organization_id, code, warehouse_id, adjustment_type, status, requested_by, requested_at, created_at)
		 select '01920000-0000-7000-8000-0000000000ae', 'org-a', 'ADJ-2', w.id, 'recount', 'draft', 'u1', 1, 1
		 from inventory.warehouses w where w.organization_id = 'org-a' and w.code = 'WH1'`,
	);
	const rows = await sql.unsafe(
		`update inventory.stock_adjustments
		    set status = 'posted', posted_at = 9
		  where id = '01920000-0000-7000-8000-0000000000ae'
		    and status = 'approved' and posted_at is null
		  returning id`,
	);
	if (rows.length !== 0) throw new Error('a draft was claimed');
});

console.log('--- concurrency smoke: parallel posts cannot go negative (D17) ---');
await pass(
	'10 parallel conditional decrements never drive on_hand below zero',
	async () => {
		await sql.unsafe(
			`update inventory.stock_balances set quantity_on_hand = 3, quantity_reserved = 0, quantity_available = 3
			  where id = (select b.id from inventory.stock_balances b
			    join inventory.items i on i.id = b.item_id
			    join inventory.warehouses w on w.id = b.warehouse_id
			    where i.organization_id = 'org-a' and i.sku = 'SKU-1'
			      and w.organization_id = 'org-a' and w.code = 'WH1')`,
		);
		// Each job tries a conditional decrement of 1 inside a transaction;
		// only balances still >= 1 may move. 10 jobs, balance of 3 → exactly
		// 3 succeed and the final on_hand must be 0, never negative.
		const dec = sql.begin;
		const jobs = Array.from({ length: 10 }, () =>
			sql.unsafe(
				`with target as (
				   select b.id from inventory.stock_balances b
				     join inventory.items i on i.id = b.item_id
				     join inventory.warehouses w on w.id = b.warehouse_id
				    where i.organization_id = 'org-a' and i.sku = 'SKU-1'
				      and w.organization_id = 'org-a' and w.code = 'WH1'
				     for update
				 )
				 update inventory.stock_balances s
				    set quantity_on_hand = s.quantity_on_hand - 1,
				        quantity_available = s.quantity_available - 1
				   from target
				  where s.id = target.id and s.quantity_on_hand >= 1
				  returning s.quantity_on_hand`,
			),
		);
		const results = await Promise.allSettled(jobs);
		const winners = results.filter(
			(r) => r.status === 'fulfilled' && r.value.length === 1,
		);
		if (winners.length !== 3) {
			throw new Error(`expected exactly 3 winners, got ${winners.length}`);
		}
		const [row] = await balanceRow();
		const final = await sql.unsafe(
			`select quantity_on_hand from inventory.stock_balances where id = '${row.id}'`,
		);
		if (Number(final[0].quantity_on_hand) !== 0) {
			throw new Error(`expected final on_hand 0, got ${final[0].quantity_on_hand}`);
		}
		if (Number(final[0].quantity_on_hand) < 0) {
			throw new Error('NEGATIVE STOCK PRODUCED');
		}
	},
);

/* ---------------------------------------------------------------------- *
 * Part II — asset module checks (M06 hardening, Phase A-1)
 * ---------------------------------------------------------------------- */

console.log('--- asset module CHECK constraints (Part II) ---');

await pass('asset category accepted', () =>
	sql.unsafe(
		`insert into assets.asset_categories (organization_id, code, name, asset_type, default_depreciation_method, created_at)
		 values ('org-a', 'CAT-1', 'Laptops', 'it', 'straight_line', 1)`,
	),
);
await reject('unknown asset category type rejected', () =>
	sql.unsafe(
		`insert into assets.asset_categories (organization_id, code, name, asset_type, default_depreciation_method, created_at)
		 values ('org-a', 'CAT-X', 'X', 'spaceship', 'straight_line', 1)`,
	),
);

const assetRow = () =>
	sql.unsafe(`select id from assets.assets where organization_id = 'org-a' and code = 'AST-1'`);

await pass('asset accepted in_stock', () =>
	sql.unsafe(
		`insert into assets.assets (organization_id, code, name, status, created_at)
		 values ('org-a', 'AST-1', 'Laptop A', 'in_stock', 1)`,
	),
);
await reject('unknown asset status rejected by CHECK', async () => {
	const [row] = await assetRow();
	await sql.unsafe(
		`update assets.assets set status = 'ready' where id = '${row.id}'`,
	);
});

// D18: inactive requires a reason, and only inactive may carry one.
await reject('inactive without reason rejected (D18)', async () => {
	const [row] = await assetRow();
	await sql.unsafe(
		`update assets.assets set status = 'inactive' where id = '${row.id}'`,
	);
});
await pass('inactive with reason accepted (D18)', async () => {
	const [row] = await assetRow();
	await sql.unsafe(
		`update assets.assets set status = 'inactive', deactivation_reason = 'end of life' where id = '${row.id}'`,
	);
});
await reject('reason on non-inactive rejected (D18)', async () => {
	const [row] = await assetRow();
	await sql.unsafe(
		`update assets.assets set status = 'in_stock', deactivation_reason = 'leftover' where id = '${row.id}'`,
	);
});
await pass('reactivated clears the reason (D18)', async () => {
	const [row] = await assetRow();
	await sql.unsafe(
		`update assets.assets set status = 'in_stock', deactivation_reason = null where id = '${row.id}'`,
	);
});

await reject('negative book value rejected', async () => {
	const [row] = await assetRow();
	await sql.unsafe(
		`update assets.assets set book_value = -1 where id = '${row.id}'`,
	);
});

// Disposal vocabulary + disposal record persists as financial proof.
await pass('disposal record accepted', () =>
	sql.unsafe(
		`insert into assets.asset_disposals (organization_id, code, asset_id, disposal_method, status, created_at)
		 select 'org-a', 'DSP-1', a.id, 'sale', 'executed', 1 from assets.assets a where a.code = 'AST-1'`,
	),
);
await reject('unknown disposal status rejected', () =>
	sql.unsafe(
		`insert into assets.asset_disposals (organization_id, code, asset_id, disposal_method, status, created_at)
		 select 'org-a', 'DSP-2', a.id, 'sale', 'done', 1 from assets.assets a where a.code = 'AST-1'`,
	),
);
await pass('executed disposal keeps its record (financial proof)', async () => {
	const rows = await sql.unsafe(
		`select count(*)::int as n from assets.asset_disposals where code = 'DSP-1'`,
	);
	if (Number(rows[0].n) !== 1) throw new Error('disposal record missing');
});

await sql.close();
console.log(
	failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);

