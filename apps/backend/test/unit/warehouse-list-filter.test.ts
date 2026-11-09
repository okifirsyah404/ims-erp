/**
 * Warehouse list status filter.
 *
 * @remarks
 * Checks the predicates the repository builds for each lifecycle bucket by
 * rendering them to SQL. No database connection is opened.
 */
import { describe, expect, test } from 'bun:test';
import { and } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { lifecycleFilter } from '../../src/app/inventory/repositories/warehouse.repository';

const dialect = new PgDialect();

/** Renders a list of predicates as one WHERE clause for assertions. */
function render(predicates: ReturnType<typeof lifecycleFilter>) {
	const clauses = predicates.filter(Boolean);
	return dialect.sqlToQuery(and(...clauses)!).sql;
}

describe('lifecycleFilter', () => {
	test('all hides archived rows and keeps inactive ones', () => {
		const sql = render(lifecycleFilter('all'));
		expect(sql).toContain('"deleted_at" is null');
		expect(sql).not.toContain('"is_active"');
	});

	test('active requires alive and is_active = true', () => {
		const sql = render(lifecycleFilter('active'));
		expect(sql).toContain('"deleted_at" is null');
		expect(sql).toContain('"is_active" = $1');
	});

	test('inactive requires alive and is_active = false', () => {
		const sql = render(lifecycleFilter('inactive'));
		expect(sql).toContain('"deleted_at" is null');
		expect(sql).toContain('"is_active" = $1');
	});

	test('archived selects only soft-deleted rows', () => {
		const sql = render(lifecycleFilter('archived'));
		expect(sql).toContain('"deleted_at" is not null');
		expect(sql).not.toContain('"deleted_at" is null');
	});
});
