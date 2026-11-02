/**
 * Throwaway constraint verification against a real PostgreSQL 18 instance.
 *
 * Not part of the test suite — this proves the generated migration's
 * constraints and partial-unique indexes behave as designed. Run manually:
 *   bun run apps/backend/database/verify-inventory-constraints.ts <url>
 */
import { SQL } from 'bun';

const url = process.argv[2] ?? 'postgresql://root:root@localhost:55432/verify';
const sql = new SQL(url);

let failures = 0;

/**
 * Every assertion below inserts fixed keys, so the script is only meaningful
 * against a clean schema. Dropping and replaying the inventory migration makes
 * the run repeatable — otherwise a second run reports the seed rows from the
 * first as failures.
 */
const { readFileSync } = await import('node:fs');
const { join } = await import('node:path');

const MIGRATION = join(
	import.meta.dir,
	'migrations',
	'20261102133850_talented_jubilee',
	'migration.sql',
);

await sql.unsafe('drop schema if exists inventory cascade');
for (const statement of readFileSync(MIGRATION, 'utf8')
	.split('--> statement-breakpoint')
	.map((chunk) => chunk.trim())
	.filter(Boolean)) {
	await sql.unsafe(statement);
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
const borrow = (
	type: string,
	cols: string,
	code: string,
) =>
	sql.unsafe(
		`insert into inventory.borrowings (organization_id, code, borrower_type, due_at, created_at ${cols}) values ('org-a', '${code}', '${type}', 2, 1 '')`,
	);

// Simpler explicit inserts below.
const borrowRow = (code: string, extra: Record<string, string | null>) => {
	const cols = Object.keys(extra);
	const vals = cols.map((c) =>
		extra[c] === null ? 'null' : `'${extra[c]}'`,
	);
	return sql.unsafe(
		`insert into inventory.borrowings (organization_id, code, due_at, created_at, ${cols.join(', ')}) values ('org-a', '${code}', 2, 1, ${vals.join(', ')})`,
	);
};

void borrow;

await pass('guest borrowing with full identity', () =>
	borrowRow('BRW-1', {
		borrower_type: 'guest',
		guest_name: 'Budi',
		guest_phone: '0812',
		guest_id_number: '3171',
	}),
);
await reject('guest borrowing without ID number', () =>
	borrowRow('BRW-2', {
		borrower_type: 'guest',
		guest_name: 'Budi',
		guest_phone: '0812',
	}),
);
await reject('user borrowing carrying a guest name', () =>
	borrowRow('BRW-3', {
		borrower_type: 'user',
		borrower_user_id: 'u1',
		guest_name: 'Budi',
	}),
);
await pass('user borrowing', () =>
	borrowRow('BRW-4', { borrower_type: 'user', borrower_user_id: 'u1' }),
);

console.log('--- borrowing event physical/movement pairing ---');
const borrowId = async (code: string) => {
	const [row] = await sql.unsafe(
		`select id from inventory.borrowings where code = '${code}'`,
	);
	return (row as { id: string }).id;
};
const evt = (borrowingId: string, type: string, movementId: string | null) =>
	sql.unsafe(
		`insert into inventory.borrowing_events (borrowing_id, event_type, stock_movement_id, occurred_at) values ('${borrowingId}', '${type}', ${
			movementId === null ? 'null' : `'${movementId}'`
		}, 1)`,
	);

const bid = await borrowId('BRW-1');
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

await sql.close();
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
