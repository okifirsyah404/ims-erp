import { describe, expect, test } from 'bun:test';
import {
	BASE_MEMBER_ROLE,
	assignableOrganizationRoles,
	erpRoleNames,
	findUnassignableRoles,
	grantableOrganizationRoles,
	offeredOrganizationRoles,
	withBaseMemberRole,
} from '../src/authorization/erp-permissions';

/**
 * Unit tests for the organization role-assignment ladder.
 *
 * @remarks
 * The dialog, the member-edit checkboxes and the backend guards all read this
 * one function, so these cases are the contract: no `owner` on an invite,
 * only an owner gives `hr`, the base `member` role is never offered but
 * always added by the backend (P7-4).
 */

const has = (roles: readonly string[], role: string) => roles.includes(role);

describe('role catalog (P7-4)', () => {
	test('the removed roles are gone from the catalog', () => {
		for (const removed of ['admin', 'sales_manager', 'accountant', 'auditor']) {
			expect(has(erpRoleNames, removed)).toBe(false);
		}
	});

	test('the offered roles are the catalog without the base member role', () => {
		expect(offeredOrganizationRoles).toEqual([
			'owner',
			'operations_manager',
			'sales',
			'project_manager',
			'technician',
			'freelancer',
			'purchasing',
			'warehouse',
			'finance',
			'hr',
			'customer_service',
			'marketing',
		]);
		expect(has(offeredOrganizationRoles, BASE_MEMBER_ROLE)).toBe(false);
	});

	test('withBaseMemberRole puts member first and drops duplicates', () => {
		expect(withBaseMemberRole(['sales', 'warehouse'])).toEqual([
			'member',
			'sales',
			'warehouse',
		]);
		expect(withBaseMemberRole(['finance', 'member', 'finance'])).toEqual([
			'member',
			'finance',
		]);
		expect(withBaseMemberRole([])).toEqual(['member']);
	});
});

describe('grantableOrganizationRoles (invitations)', () => {
	test('a platform admin may invite every offered role except owner', () => {
		const roles = grantableOrganizationRoles(['owner'], {
			isPlatformAdmin: true,
		});
		expect(has(roles, 'owner')).toBe(false);
		expect(has(roles, 'hr')).toBe(true);
		expect(has(roles, 'sales')).toBe(true);
		expect(has(roles, 'member')).toBe(false);
	});

	test('an owner may invite hr and every other offered role', () => {
		const roles = grantableOrganizationRoles(['owner']);
		expect(has(roles, 'hr')).toBe(true);
		expect(has(roles, 'finance')).toBe(true);
		expect(has(roles, 'freelancer')).toBe(true);
	});

	test('organization HR may not offer owner or hr', () => {
		const roles = grantableOrganizationRoles(['hr']);
		expect(has(roles, 'owner')).toBe(false);
		expect(has(roles, 'hr')).toBe(false);
		expect(has(roles, 'technician')).toBe(true);
	});

	test('an owner still may not invite an owner (owner is born, never granted)', () => {
		expect(has(grantableOrganizationRoles(['owner']), 'owner')).toBe(false);
	});

	test('nobody is offered the base member role or a removed role', () => {
		for (const caller of [['owner'], ['hr'], ['member'], []]) {
			const roles = grantableOrganizationRoles(caller, { isPlatformAdmin: true });
			for (const hidden of ['member', 'admin', 'sales_manager', 'accountant', 'auditor']) {
				expect(has(roles, hidden)).toBe(false);
			}
		}
	});

	test('the result follows catalog order and contains no duplicates', () => {
		const roles = grantableOrganizationRoles(['owner']);
		expect(new Set(roles).size).toBe(roles.length);
		expect(roles.indexOf('sales')).toBeLessThan(roles.indexOf('finance'));
	});
});

describe('assignableOrganizationRoles (member management)', () => {
	test('an owner may assign owner (member management) but never on an invite', () => {
		expect(has(assignableOrganizationRoles(['owner']), 'owner')).toBe(true);
		expect(has(grantableOrganizationRoles(['owner']), 'owner')).toBe(false);
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

	test('org HR may not grant hr, but keeps an existing hr grant', () => {
		expect(has(assignableOrganizationRoles(['hr']), 'hr')).toBe(false);
		expect(
			has(assignableOrganizationRoles(['hr'], { currentRoles: ['hr'] }), 'hr'),
		).toBe(true);
	});
});

describe('findUnassignableRoles', () => {
	test('reports the roles outside the allowed set', () => {
		expect(findUnassignableRoles(['owner', 'sales'], ['sales'])).toEqual([
			'owner',
		]);
	});

	test('is empty when every requested role is allowed', () => {
		expect(findUnassignableRoles(['sales', 'finance'], ['sales', 'finance'])).toEqual(
			[],
		);
	});

	test('the base member role is always accepted (P7-4)', () => {
		expect(findUnassignableRoles(['member', 'sales'], ['sales'])).toEqual([]);
	});

	test('a removed role is reported, not ignored', () => {
		expect(findUnassignableRoles(['sales_manager'], ['sales'])).toEqual([
			'sales_manager',
		]);
	});
});
