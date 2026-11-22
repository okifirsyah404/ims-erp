import { describe, expect, test } from 'bun:test';
import {
	ACCOUNT_NOT_ACTIVE,
	WEB_ADMIN_ACCESS_DENIED,
	hasInternalOrgRole,
	isAccountActive,
	isWebAdminAllowed,
	webAdminDenial,
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

describe('isAccountActive (ERP-0109)', () => {
	test('only an active, not deleted row may sign in', () => {
		expect(isAccountActive({ status: 'active', deletedAt: null })).toBe(true);
		expect(isAccountActive({ status: 'pending', deletedAt: null })).toBe(false);
		expect(isAccountActive({ status: 'deactivated', deletedAt: null })).toBe(false);
		expect(isAccountActive({ status: 'active', deletedAt: new Date() })).toBe(false);
	});

	test('a null status (row older than the column) counts as active', () => {
		expect(isAccountActive({ status: null, deletedAt: null })).toBe(true);
	});
});

describe('webAdminDenial (ERP-0109)', () => {
	const admin = { userRole: 'admin', memberRoles: [] as string[] };

	test('allowed: active admin or active internal member', () => {
		expect(webAdminDenial({ ...admin, status: 'active', deletedAt: null })).toBeNull();
		expect(
			webAdminDenial({ userRole: 'user', memberRoles: ['sales'], status: 'active', deletedAt: null }),
		).toBeNull();
	});

	test('a pending invitation is refused even for an invited admin', () => {
		expect(webAdminDenial({ ...admin, status: 'pending', deletedAt: null })).toBe(ACCOUNT_NOT_ACTIVE);
	});

	test('deactivated and deleted accounts are refused before the role check', () => {
		expect(webAdminDenial({ ...admin, status: 'deactivated', deletedAt: null })).toBe(
			ACCOUNT_NOT_ACTIVE,
		);
		expect(webAdminDenial({ ...admin, status: 'active', deletedAt: new Date() })).toBe(
			ACCOUNT_NOT_ACTIVE,
		);
	});

	test('an active account without an internal role keeps the role denial', () => {
		expect(
			webAdminDenial({ userRole: 'investor', memberRoles: [], status: 'active', deletedAt: null }),
		).toBe(WEB_ADMIN_ACCESS_DENIED);
	});
});
