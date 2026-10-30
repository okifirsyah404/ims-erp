import { describe, expect, test } from 'bun:test';
import { erpRoles, organizationStatements } from '../../src/lib/erp-ac';
import { erpRoleNames } from '../../src/lib/permissions';

describe('erp access control client', () => {
	test('every role name has a constructed role', () => {
		for (const name of erpRoleNames) {
			expect(erpRoles[name as keyof typeof erpRoles]).toBeDefined();
		}
	});

	test('roles only declare resources present in organizationStatements', () => {
		for (const role of Object.values(erpRoles)) {
			const statements = (role as unknown as { statements: Record<string, readonly string[]> }).statements;
			for (const resource of Object.keys(statements ?? {})) {
				expect(Object.keys(organizationStatements)).toContain(resource);
			}
		}
	});
});
