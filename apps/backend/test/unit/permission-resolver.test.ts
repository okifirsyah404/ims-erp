/**
 * Unit tests for the dynamic permission resolver (phase 3).
 *
 * The DB is mocked at the Drizzle seam (`mockDb` helper) - no real
 * connection is opened (bun-test skill rule 2.1).
 */
import { describe, expect, test } from 'bun:test';
import { mockDb } from '../helpers/mock-db';
import { DynamicPermissionResolver } from '../../src/authorization/dynamic-permissions';
import { grantsAllow } from '../../src/authorization/permission-resolver';
import { erpRoleGrants } from '@ims-erp/common';

describe('dynamic permission resolver', () => {
	test('grants the requested action from the live role row', async () => {
		const { db } = mockDb({
			rows: [{ name: 'owner', permissions: erpRoleGrants.owner }],
		});
		const resolver = new DynamicPermissionResolver(db as never);

		expect(
			await resolver.hasPermission('org-a', ['owner'], { quotation: ['read'] }),
		).toBe(true);
	});

	test('denies an action the live role row does not grant', async () => {
		const { db } = mockDb({
			rows: [{ name: 'member', permissions: erpRoleGrants.member }],
		});
		const resolver = new DynamicPermissionResolver(db as never);

		expect(
			await resolver.hasPermission('org-a', ['member'], { quotation: ['create'] }),
		).toBe(false);
	});

	test('unions grants across multiple live roles', async () => {
		const { db } = mockDb({
			rows: [
				{ name: 'sales', permissions: erpRoleGrants.sales },
				{ name: 'finance', permissions: erpRoleGrants.finance },
			],
		});
		const resolver = new DynamicPermissionResolver(db as never);

		expect(
			await resolver.hasPermission('org-a', ['sales', 'finance'], {
				quotation: ['create'],
				payment: ['execute'],
			}),
		).toBe(true);
	});

	test('live rows are authoritative: a role row without the grant denies it', async () => {
		// `owner` exists as a live row but only carries a restricted grant:
		// the static catalog fallback must NOT kick in.
		const { db } = mockDb({
			rows: [{ name: 'owner', permissions: { dashboard: ['read'] } }],
		});
		const resolver = new DynamicPermissionResolver(db as never);

		expect(
			await resolver.hasPermission('org-a', ['owner'], { quotation: ['read'] }),
		).toBe(false);
	});

	test('falls back to the static catalog when no live row matches', async () => {
		const { db } = mockDb({ rows: [] });
		const resolver = new DynamicPermissionResolver(db as never);

		expect(
			await resolver.hasPermission('org-a', ['owner'], { quotation: ['read'] }),
		).toBe(true);
		expect(
			await resolver.hasPermission('org-a', ['member'], { quotation: ['create'] }),
		).toBe(false);
	});

	test('no roles denies everything', async () => {
		const { db } = mockDb({ rows: [] });
		const resolver = new DynamicPermissionResolver(db as never);

		expect(
			await resolver.hasPermission('org-a', [], { dashboard: ['read'] }),
		).toBe(false);
	});
});

describe('grantsAllow', () => {
	test('requires every requested action', () => {
		expect(
			grantsAllow([{ quotation: ['read', 'create'] }], { quotation: ['create'] }),
		).toBe(true);
		expect(
			grantsAllow([{ quotation: ['read'] }], { quotation: ['read', 'create'] }),
		).toBe(false);
	});

	test('denies unlisted resources (deny-by-default)', () => {
		expect(grantsAllow([{ quotation: ['read'] }], { payment: ['read'] })).toBe(false);
	});

	test('unions across roles', () => {
		expect(
			grantsAllow(
				[{ quotation: ['read'] }, { payment: ['execute'] }],
				{ quotation: ['read'], payment: ['execute'] },
			),
		).toBe(true);
	});
});
