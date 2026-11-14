import { describe, expect, test } from 'bun:test';
import {
	hasInternalOrgRole,
	isWebAdminAllowed,
} from '../../src/providers/better-auth/ac/login-gate';
import { hasAppRole } from '../../src/providers/better-auth/ac/admin-ac';

describe('hasAppRole (multi-role user.role)', () => {
	test('reads one role out of a comma-joined list', () => {
		expect(hasAppRole('admin,investor', 'admin')).toBe(true);
		expect(hasAppRole('investor, admin', 'admin')).toBe(true);
	});

	test('does not match a substring of another role', () => {
		expect(hasAppRole('superadmin', 'admin')).toBe(false);
		expect(hasAppRole(null, 'admin')).toBe(false);
	});
});

describe('hasInternalOrgRole', () => {
	test('investor and customer are not organization roles', () => {
		expect(hasInternalOrgRole('investor')).toBe(false);
		expect(hasInternalOrgRole('customer')).toBe(false);
	});

	test('any organization role counts, including freelancer and auditor', () => {
		expect(hasInternalOrgRole('sales')).toBe(true);
		expect(hasInternalOrgRole('freelancer')).toBe(true);
		expect(hasInternalOrgRole('auditor')).toBe(true);
	});
});

describe('isWebAdminAllowed (ADR-0017 §8, amended by ADR-0018)', () => {
	test('application admin without membership is allowed', () => {
		expect(isWebAdminAllowed({ userRole: 'admin', memberRoles: [] })).toBe(true);
	});

	test('investor-only user is rejected', () => {
		expect(isWebAdminAllowed({ userRole: 'investor', memberRoles: [] })).toBe(false);
	});

	test('investor with an internal membership is allowed', () => {
		expect(isWebAdminAllowed({ userRole: 'investor', memberRoles: ['sales'] })).toBe(true);
	});

	test('admin,investor with an internal membership is allowed', () => {
		expect(isWebAdminAllowed({ userRole: 'admin,investor', memberRoles: ['sales'] })).toBe(true);
	});

	test('PIC without any membership is rejected (no PIC bypass)', () => {
		expect(isWebAdminAllowed({ userRole: 'user', memberRoles: [] })).toBe(false);
	});

	test('user whose memberships hold only null/empty roles is rejected', () => {
		expect(isWebAdminAllowed({ userRole: 'user', memberRoles: [null, ''] })).toBe(false);
	});
});
