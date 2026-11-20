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
 * The dialog hides the options, but these guards are the boundary: an org
 * admin must not invite an `owner`, and org HR must not invite `admin`/`hr`.
 * The ladder itself is shared data from `@ims-erp/common`, so these tests pin
 * the wiring (guard context in, illegal roles out) rather than the tiers.
 */

const ctx = (
	callerRoles: string[],
	isPlatformAdmin = false,
): TRoleAssignmentContext => ({ callerRoles, isPlatformAdmin });

describe('grantableRolesFor', () => {
	test('never offers owner, whatever the caller holds', () => {
		for (const roles of [['owner'], ['admin'], ['hr'], ['member'], []]) {
			expect(grantableRolesFor(ctx(roles))).not.toContain('owner');
		}
	});

	test('an org admin loses admin but keeps hr', () => {
		const roles = grantableRolesFor(ctx(['admin']));
		expect(roles).not.toContain('admin');
		expect(roles).toContain('hr');
	});

	test('org HR loses admin and hr', () => {
		const roles = grantableRolesFor(ctx(['hr']));
		expect(roles).not.toContain('admin');
		expect(roles).not.toContain('hr');
		expect(roles).toContain('member');
	});

	test('a platform admin may invite admin and hr but never owner', () => {
		const roles = grantableRolesFor(ctx([], true));
		expect(roles).toContain('admin');
		expect(roles).toContain('hr');
		expect(roles).not.toContain('owner');
	});
});

describe('unassignableInviteRoles', () => {
	test('an org admin inviting an owner is reported', () => {
		expect(unassignableInviteRoles(ctx(['admin']), ['owner'])).toEqual(['owner']);
	});

	test('org HR inviting admin is reported', () => {
		expect(unassignableInviteRoles(ctx(['hr']), ['admin'])).toEqual(['admin']);
	});

	test('a legal invite passes', () => {
		expect(unassignableInviteRoles(ctx(['admin']), ['member', 'finance'])).toEqual([]);
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

	test('an admin may keep admin on a member who already holds it', () => {
		expect(assignableRolesFor(ctx(['admin']), ['admin'])).toContain('admin');
		expect(unassignableMemberRoles(ctx(['admin']), ['admin'], ['admin'])).toEqual([]);
	});

	test('an admin may not promote a member to admin', () => {
		expect(unassignableMemberRoles(ctx(['admin']), ['admin'], ['member'])).toEqual([
			'admin',
		]);
	});
});
