import { describe, expect, test } from 'bun:test';
import {
	createUserSchema,
	setUserRoleSchema,
} from '../../src/app/user/contracts/user.contract';

/**
 * `user.role` is free text and every role check reads it (ADR-0018), so the
 * admin API must never write a value outside the closed global role list.
 */
describe('global role contract', () => {
	test('accepts every declared global role', () => {
		for (const role of ['admin', 'user', 'investor', 'customer']) {
			expect(setUserRoleSchema.safeParse({ role }).success).toBe(true);
		}
	});

	test('rejects an unknown, empty, or multi-role value on set-role', () => {
		for (const role of ['superadmin', '', 'admin,investor', 'INVESTOR']) {
			expect(setUserRoleSchema.safeParse({ role }).success).toBe(false);
		}
	});

	test('create-user applies the same closed list', () => {
		const base = {
			email: 'a@b.co',
			password: 'password123',
			name: 'A',
		};
		expect(createUserSchema.safeParse({ ...base, role: 'investor' }).success).toBe(true);
		expect(createUserSchema.safeParse(base).success).toBe(true);
		expect(createUserSchema.safeParse({ ...base, role: 'superadmin' }).success).toBe(false);
	});
});
