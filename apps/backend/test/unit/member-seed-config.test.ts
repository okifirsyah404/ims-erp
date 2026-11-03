import { describe, expect, test } from 'bun:test';
import {
	MEMBER_SEED_CONFIG,
	type TMemberSeedEntry,
} from '../../database/seeders/seed/organization-members.seeder';
import { erpRoleNames } from '@ims-erp/common';

describe('MEMBER_SEED_CONFIG', () => {
	test('every configured role exists in the shared ERP catalog', () => {
		for (const entry of MEMBER_SEED_CONFIG) {
			expect(erpRoleNames).toContain(entry.role);
		}
	});

	test('counts are non-negative integers', () => {
		for (const entry of MEMBER_SEED_CONFIG) {
			expect(Number.isInteger(entry.userCount)).toBe(true);
			expect(entry.userCount).toBeGreaterThanOrEqual(0);
		}
	});

	test('roles are unique', () => {
		const roles = MEMBER_SEED_CONFIG.map(
			(entry: TMemberSeedEntry) => entry.role,
		);
		expect(new Set(roles).size).toBe(roles.length);
	});

	test('seeds at least one account overall (pagination demo volume)', () => {
		const total = MEMBER_SEED_CONFIG.reduce(
			(sum, entry) => sum + entry.userCount,
			0,
		);
		expect(total).toBeGreaterThan(20);
	});
});
