/**
 * Permission matrix unit tests: role grants from the shared catalog through
 * the backend access control (authorizeErpPermissions / requirePermission).
 */
import { describe, expect, test } from 'bun:test';
import {
	authorizeErpPermissions,
	erpRoles,
	organizationStatements,
} from '../../src/providers/better-auth/ac/organization-ac';
import { erpRoleNames } from '@ims-erp/common';

describe('organization access control', () => {
	test('defines all 18 ERP roles', () => {
		for (const role of erpRoleNames) {
			expect(erpRoles[role]).toBeDefined();
		}
		expect(Object.keys(erpRoles).length).toBe(erpRoleNames.length);
	});

	test('statement vocabulary includes built-in organization resources', () => {
		expect(organizationStatements.organization).toBeDefined();
		expect(organizationStatements.member).toBeDefined();
		expect(organizationStatements.invitation).toBeDefined();
		expect(organizationStatements.ac).toBeDefined();
	});

	test('owner has full ERP permissions', () => {
		expect(
			authorizeErpPermissions(['owner'], {
				quotation: ['approve', 'create'],
				payment: ['execute'],
				payroll: ['calculate'],
				invoice: ['issue'],
			}),
		).toBe(true);
	});

	test('owner retains built-in organization administration', () => {
		expect(
			authorizeErpPermissions(['owner'], { member: ['delete'], organization: ['delete'] }),
		).toBe(true);
	});

	test('org admin has membership administration but NOT payroll/payment', () => {
		expect(authorizeErpPermissions(['admin'], { member: ['create'] })).toBe(true);
		expect(authorizeErpPermissions(['admin'], { invitation: ['create'] })).toBe(true);
		expect(authorizeErpPermissions(['admin'], { payroll: ['read'] })).toBe(false);
		expect(authorizeErpPermissions(['admin'], { payment: ['execute'] })).toBe(false);
		expect(authorizeErpPermissions(['admin'], { integration: ['rotate_secret'] })).toBe(false);
	});

	test('member has only baseline access', () => {
		expect(authorizeErpPermissions(['member'], { dashboard: ['read'] })).toBe(true);
		expect(authorizeErpPermissions(['member'], { quotation: ['create'] })).toBe(false);
		expect(authorizeErpPermissions(['member'], { employee: ['read'] })).toBe(false);
	});

	test('sales can create but not approve quotations', () => {
		expect(authorizeErpPermissions(['sales'], { quotation: ['create', 'submit'] })).toBe(true);
		expect(authorizeErpPermissions(['sales'], { quotation: ['approve'] })).toBe(false);
	});

	test('sales_manager can approve but not execute payments', () => {
		expect(authorizeErpPermissions(['sales_manager'], { quotation: ['approve'] })).toBe(true);
		expect(authorizeErpPermissions(['sales_manager'], { payment: ['execute'] })).toBe(false);
	});

	test('finance executes payments but has no HR record access', () => {
		expect(authorizeErpPermissions(['finance'], { payment: ['execute'] })).toBe(true);
		expect(authorizeErpPermissions(['finance'], { employee: ['read'] })).toBe(false);
		expect(authorizeErpPermissions(['finance'], { payroll: ['read'] })).toBe(false);
	});

	test('hr prepares payroll but cannot approve or execute it', () => {
		expect(authorizeErpPermissions(['hr'], { payroll: ['create', 'calculate', 'submit'] })).toBe(true);
		expect(authorizeErpPermissions(['hr'], { payroll: ['approve'] })).toBe(false);
		expect(authorizeErpPermissions(['hr'], { payroll_payment: ['execute'] })).toBe(false);
	});

	test('auditor is read/export only', () => {
		expect(authorizeErpPermissions(['auditor'], { journal: ['read', 'export'] })).toBe(true);
		expect(authorizeErpPermissions(['auditor'], { journal: ['create'] })).toBe(false);
		expect(authorizeErpPermissions(['auditor'], { payment: ['execute'] })).toBe(false);
	});

	test('technician has no customer database access', () => {
		expect(authorizeErpPermissions(['technician'], { customer: ['read'] })).toBe(false);
		expect(authorizeErpPermissions(['technician'], { daily_report: ['create'] })).toBe(true);
	});

	test('freelancer has no customer/payroll/margin access', () => {
		expect(authorizeErpPermissions(['freelancer'], { customer: ['read'] })).toBe(false);
		expect(authorizeErpPermissions(['freelancer'], { payroll: ['read'] })).toBe(false);
	});

	test('investor portal role is limited to portal reads', () => {
		expect(
			authorizeErpPermissions(['investor'], {
				investor_portal: ['read_commitment', 'read_report'],
			}),
		).toBe(true);
		expect(authorizeErpPermissions(['investor'], { invoice: ['read'] })).toBe(false);
		expect(authorizeErpPermissions(['investor'], { financial_report: ['read'] })).toBe(false);
	});

	test('customer portal role is limited to portal actions', () => {
		expect(authorizeErpPermissions(['customer'], { customer_portal: ['create_ticket'] })).toBe(true);
		expect(authorizeErpPermissions(['customer'], { invoice: ['read'] })).toBe(false);
	});

	test('marketing has no integration secrets or automation execution', () => {
		expect(authorizeErpPermissions(['marketing'], { integration: ['read'] })).toBe(false);
		expect(authorizeErpPermissions(['marketing'], { automation: ['execute'] })).toBe(false);
		expect(authorizeErpPermissions(['marketing'], { catalog: ['publish'] })).toBe(true);
	});

	test('unknown roles deny everything', () => {
		expect(authorizeErpPermissions(['nonexistent'], { dashboard: ['read'] })).toBe(false);
		expect(authorizeErpPermissions([], { dashboard: ['read'] })).toBe(false);
	});

	test('multi-role union grants combined permissions', () => {
		expect(
			authorizeErpPermissions(['sales', 'warehouse'], {
				quotation: ['create'],
				stock: ['receive'],
			}),
		).toBe(true);
	});

	test('unspecified permissions are denied (deny-by-default)', () => {
		expect(authorizeErpPermissions(['sales'], { tax: ['create'] })).toBe(false);
		expect(authorizeErpPermissions(['warehouse'], { supplier: ['create'] })).toBe(false);
	});
});
