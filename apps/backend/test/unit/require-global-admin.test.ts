/**
 * Unit tests for the shared {@link requireGlobalAdmin} gate.
 *
 * @remarks
 * This helper was previously three private copies with **no test coverage at
 * all** — the inventory plan assumed the organization-bootstrap controller's
 * "existing tests" covered it, and there were none. These tests are the actual
 * safety net for the policy that every warehouse route depends on.
 *
 * The distinction under test is deliberately narrow: the **platform** role
 * (`session.user.role`) decides access, and an organization role that happens
 * to be named `admin` must not.
 */
import { describe, expect, test } from 'bun:test';
import { NotGlobalAdminError } from '@http/errors';
import {
	isGlobalAdmin,
	requireGlobalAdmin,
} from '../../src/authorization/require-global-admin';

/** Minimal structural session; the helper only reads `session.user.role`. */
const context = (role: string | undefined) =>
	({
		erp: { session: { user: { role } } },
	}) as never;

describe('requireGlobalAdmin', () => {
	test('allows the platform administrator role', () => {
		expect(() => requireGlobalAdmin(context('admin'))).not.toThrow();
	});

	test.each([
		['user', 'a plain platform user'],
		['owner', 'an organization owner role'],
		['sales', 'an organization sales role'],
		['', 'an empty role'],
	])('rejects %p (%s) with 403', (role) => {
		expect(() => requireGlobalAdmin(context(role))).toThrow(
			NotGlobalAdminError,
		);
	});

	test('rejects a missing role', () => {
		expect(() => requireGlobalAdmin(context(undefined))).toThrow(
			NotGlobalAdminError,
		);
	});

	test('maps to 403 with the shared i18n key', () => {
		try {
			requireGlobalAdmin(context('user'));
			throw new Error('expected requireGlobalAdmin to throw');
		} catch (error) {
			expect(error).toBeInstanceOf(NotGlobalAdminError);
			const appError = error as NotGlobalAdminError;
			expect(appError.status).toBe(403);
			expect(appError.key).toBe('user.globalAdminRequired');
		}
	});
});

describe('isGlobalAdmin', () => {
	test('mirrors the throwing form', () => {
		expect(isGlobalAdmin(context('admin'))).toBe(true);
		expect(isGlobalAdmin(context('user'))).toBe(false);
		expect(isGlobalAdmin(context('owner'))).toBe(false);
		expect(isGlobalAdmin(context(undefined))).toBe(false);
	});
});
