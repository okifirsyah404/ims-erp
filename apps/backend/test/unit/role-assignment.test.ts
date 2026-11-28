import { describe, expect, test } from 'bun:test';
import {
	assignableRolesFor,
	grantableRolesFor,
	unassignableInviteRoles,
	unassignableMemberRoles,
	type TRoleAssignmentContext,
} from '../../src/authorization/role-assignment';

/**
 * Unit tests for the server-side role-assignment enforcement.
 *
 * @remarks
 * The dialog hides the options, but these guards are the boundary: nobody
 * invites an `owner`, only an owner gives `hr`, the removed roles (P7-4) are
 * refused, and the base `member` role is accepted because the backend adds it
 * anyway. The ladder itself is shared data from `@ims-erp/common`, so these
 * tests pin the wiring (guard context in, illegal roles out).
 */

const ctx = (
	callerRoles: string[],
	isPlatformAdmin = false,
): TRoleAssignmentContext => ({ callerRoles, isPlatformAdmin });

const REMOVED = ['admin', 'sales_manager', 'accountant', 'auditor'];

describe('grantableRolesFor', () => {
	test('never offers owner, whatever the caller holds', () => {
		for (const roles of [['owner'], ['hr'], ['member'], []]) {
			expect(grantableRolesFor(ctx(roles))).not.toContain('owner');
		}
	});

	test('never offers the base member role or a removed role (OA9, P7-4)', () => {
		for (const roles of [['owner'], ['hr'], []]) {
			const offered = grantableRolesFor(ctx(roles, true));
			expect(offered).not.toContain('member');
			for (const removed of REMOVED) expect(offered).not.toContain(removed);
		}
	});

	test('an owner may offer hr', () => {
		expect(grantableRolesFor(ctx(['owner']))).toContain('hr');
	});

	test('org HR loses hr', () => {
		const roles = grantableRolesFor(ctx(['hr']));
		expect(roles).not.toContain('hr');
		expect(roles).toContain('sales');
	});

	test('a platform admin may invite hr but never owner', () => {
		const roles = grantableRolesFor(ctx([], true));
		expect(roles).toContain('hr');
		expect(roles).not.toContain('owner');
	});
});

describe('unassignableInviteRoles', () => {
	test('inviting an owner is reported', () => {
		expect(unassignableInviteRoles(ctx(['owner']), ['owner'])).toEqual(['owner']);
	});

	test('org HR inviting hr is reported', () => {
		expect(unassignableInviteRoles(ctx(['hr']), ['hr'])).toEqual(['hr']);
	});

	test('a removed role is reported (P7-4)', () => {
		expect(unassignableInviteRoles(ctx(['owner']), ['sales_manager', 'sales'])).toEqual([
			'sales_manager',
		]);
		expect(unassignableInviteRoles(ctx([], true), ['admin'])).toEqual(['admin']);
	});

	test('a legal multi-role invite passes, with or without member', () => {
		expect(unassignableInviteRoles(ctx(['owner']), ['sales', 'warehouse'])).toEqual([]);
		expect(unassignableInviteRoles(ctx(['owner']), ['member', 'finance'])).toEqual([]);
	});

	test('an application-level invite carries no roles and passes', () => {
		expect(unassignableInviteRoles(ctx(['member']), [])).toEqual([]);
	});
});

describe('member management', () => {
	test('an existing owner grant is preserved for an owner caller', () => {
		expect(assignableRolesFor(ctx(['owner']), ['owner'])).toContain('owner');
	});

	test('a platform admin with no owner membership cannot set owner', () => {
		expect(assignableRolesFor(ctx([], true), ['owner'])).not.toContain('owner');
	});

	test('org HR may keep hr on a member who already holds it', () => {
		expect(unassignableMemberRoles(ctx(['hr']), ['hr', 'member'], ['member', 'hr'])).toEqual([]);
	});

	test('org HR may not promote a member to hr', () => {
		expect(unassignableMemberRoles(ctx(['hr']), ['hr'], ['member'])).toEqual(['hr']);
	});

	test('a removed role cannot be kept, even when the member holds it (P7-4)', () => {
		expect(
			unassignableMemberRoles(ctx(['owner']), ['admin', 'sales'], ['member', 'admin']),
		).toEqual(['admin']);
	});
});
