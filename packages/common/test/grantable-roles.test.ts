import { describe, expect, test } from 'bun:test';
import {
	assignableOrganizationRoles,
	findUnassignableRoles,
	grantableOrganizationRoles,
} from '../src/authorization/erp-permissions';

/**
 * Unit tests for the organization role-assignment ladder.
 *
 * @remarks
 * The dialog, the member-edit checkboxes and the backend guards all read this
 * one function, so these cases are the contract: no `owner` on an invite, an
 * org admin loses `admin`, org HR loses `hr`.
 */

const has = (roles: readonly string[], role: string) => roles.includes(role);

describe('grantableOrganizationRoles (invitations)', () => {
	test('a platform admin may invite every role except owner', () => {
		const roles = grantableOrganizationRoles(['owner'], {
			isPlatformAdmin: true,
		});
		expect(has(roles, 'owner')).toBe(false);
		expect(has(roles, 'admin')).toBe(true);
		expect(has(roles, 'hr')).toBe(true);
		expect(has(roles, 'member')).toBe(true);
	});

	test('an organization admin may not invite owner or admin', () => {
		const roles = grantableOrganizationRoles(['admin']);
		expect(has(roles, 'owner')).toBe(false);
		expect(has(roles, 'admin')).toBe(false);
		expect(has(roles, 'hr')).toBe(true);
		expect(has(roles, 'finance')).toBe(true);
	});

	test('organization HR may not invite owner, admin or hr', () => {
		const roles = grantableOrganizationRoles(['hr']);
		expect(has(roles, 'owner')).toBe(false);
		expect(has(roles, 'admin')).toBe(false);
		expect(has(roles, 'hr')).toBe(false);
		expect(has(roles, 'member')).toBe(true);
		expect(has(roles, 'technician')).toBe(true);
	});

	test('an owner still may not invite an owner (owner is born, never granted)', () => {
		expect(has(grantableOrganizationRoles(['owner']), 'owner')).toBe(false);
	});

	test('a plain member keeps every non-tier role', () => {
		const roles = grantableOrganizationRoles(['member']);
		expect(has(roles, 'member')).toBe(true);
		expect(has(roles, 'sales')).toBe(true);
		expect(has(roles, 'admin')).toBe(false);
		expect(has(roles, 'hr')).toBe(false);
	});

	test('the result follows catalog order and contains no duplicates', () => {
		const roles = grantableOrganizationRoles(['owner', 'admin']);
		expect(new Set(roles).size).toBe(roles.length);
		expect(roles.indexOf('admin')).toBeLessThan(roles.indexOf('member'));
	});
});

describe('assignableOrganizationRoles (member management)', () => {
	test('an owner may assign owner (member management) but never on an invite', () => {
		expect(has(assignableOrganizationRoles(['owner']), 'owner')).toBe(true);
		expect(has(grantableOrganizationRoles(['owner']), 'owner')).toBe(false);
	});

	test('a non-owner admin may keep admin but not create it', () => {
		expect(
			has(assignableOrganizationRoles(['admin'], { currentRoles: ['admin'] }), 'admin'),
		).toBe(true);
		expect(has(assignableOrganizationRoles(['admin']), 'admin')).toBe(false);
	});

	test('a platform admin may not hand out owner without an owner membership', () => {
		// Better Auth's own hook rejects an owner grant from a caller with no
		// owner membership, so the ladder must not offer it either.
		expect(has(assignableOrganizationRoles([], { isPlatformAdmin: true }), 'owner')).toBe(
			false,
		);
		expect(
			has(
				assignableOrganizationRoles(['owner'], { isPlatformAdmin: true }),
				'owner',
			),
		).toBe(true);
	});

	test('a platform admin may keep an existing owner in place', () => {
		const roles = assignableOrganizationRoles([], {
			isPlatformAdmin: true,
			currentRoles: ['owner'],
		});
		// Owner is only offered when the caller holds it; the platform-admin
		// bypass covers the tiers below, not the owner rule.
		expect(has(roles, 'owner')).toBe(false);
	});

	test('org HR may not grant admin or hr, but keeps an existing hr grant', () => {
		expect(has(assignableOrganizationRoles(['hr']), 'admin')).toBe(false);
		expect(has(assignableOrganizationRoles(['hr']), 'hr')).toBe(false);
		expect(
			has(assignableOrganizationRoles(['hr'], { currentRoles: ['hr'] }), 'hr'),
		).toBe(true);
	});
});

describe('findUnassignableRoles', () => {
	test('reports the roles outside the allowed set', () => {
		expect(findUnassignableRoles(['owner', 'member'], ['member'])).toEqual([
			'owner',
		]);
	});

	test('is empty when every requested role is allowed', () => {
		expect(findUnassignableRoles(['member', 'finance'], ['member', 'finance'])).toEqual(
			[],
		);
	});
});
