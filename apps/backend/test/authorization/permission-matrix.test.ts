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
import { erpRoleGrants, erpRoleNames } from '@ims-erp/common';

describe('organization access control', () => {
	test('defines every organization role (ADR-0018: no investor/customer)', () => {
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

	test('the base member role only reads its own access (P7-4)', () => {
		expect(authorizeErpPermissions(['member'], { ac: ['read'] })).toBe(true);
		expect(authorizeErpPermissions(['member'], { dashboard: ['read'] })).toBe(false);
		expect(authorizeErpPermissions(['member'], { master_data: ['read'] })).toBe(false);
		expect(authorizeErpPermissions(['member'], { self_service: ['read_payslip'] })).toBe(false);
		expect(authorizeErpPermissions(['member'], { quotation: ['create'] })).toBe(false);
	});

	test('adding the base member role never widens another role (P7-4)', () => {
		expect(authorizeErpPermissions(['member', 'freelancer'], { dashboard: ['read'] })).toBe(false);
		expect(authorizeErpPermissions(['member', 'freelancer'], { customer: ['read'] })).toBe(false);
	});

	test('the removed roles grant nothing (P7-4)', () => {
		for (const removed of ['admin', 'sales_manager', 'accountant', 'auditor']) {
			expect(authorizeErpPermissions([removed], { ac: ['read'] })).toBe(false);
		}
	});

	test('sales holds the former sales manager grants (K2b)', () => {
		expect(authorizeErpPermissions(['sales'], { quotation: ['create', 'submit', 'approve', 'reject'] })).toBe(true);
		expect(authorizeErpPermissions(['sales'], { sales_return: ['approve'] })).toBe(true);
		expect(authorizeErpPermissions(['sales'], { sales_order: ['cancel'] })).toBe(true);
		expect(authorizeErpPermissions(['sales'], { customer: ['archive'] })).toBe(true);
		expect(authorizeErpPermissions(['sales'], { portal_account: ['invite', 'revoke'] })).toBe(true);
		expect(authorizeErpPermissions(['sales'], { license: ['manage_api', 'revoke', 'activate'] })).toBe(true);
		expect(authorizeErpPermissions(['sales'], { apiKey: ['create', 'update'] })).toBe(true);
		expect(authorizeErpPermissions(['sales'], { catalog: ['publish'] })).toBe(true);
		expect(authorizeErpPermissions(['sales'], { whatsapp: ['reply'] })).toBe(true);
		expect(authorizeErpPermissions(['sales'], { payment: ['execute'] })).toBe(false);
	});

	test('finance holds the former accountant grants (K2d, RO1)', () => {
		expect(
			authorizeErpPermissions(['finance'], {
				chart_of_account: ['read', 'create', 'update', 'archive'],
				journal: ['read', 'create', 'post', 'reverse'],
				accounting_period: ['read', 'create', 'close'],
				asset: ['read'],
				project: ['read'],
				budget: ['read'],
				investor_report: ['read', 'create', 'publish'],
				tax: ['verify'],
			}),
		).toBe(true);
	});

	test('reopening a period is owner-only (RO4)', () => {
		expect(authorizeErpPermissions(['owner'], { accounting_period: ['reopen'] })).toBe(true);
		for (const role of erpRoleNames.filter((name) => name !== 'owner')) {
			expect(authorizeErpPermissions([role], { accounting_period: ['reopen'] })).toBe(false);
		}
	});

	test('the audit log is owner-only (OA8)', () => {
		expect(authorizeErpPermissions(['owner'], { audit_log: ['read'] })).toBe(true);
		for (const role of erpRoleNames.filter((name) => name !== 'owner')) {
			expect(authorizeErpPermissions([role], { audit_log: ['read'] })).toBe(false);
		}
	});

	test('only the owner invites (OA12)', () => {
		expect(authorizeErpPermissions(['owner'], { invitation: ['create'] })).toBe(true);
		for (const role of erpRoleNames.filter((name) => name !== 'owner')) {
			expect(authorizeErpPermissions([role], { invitation: ['create'] })).toBe(false);
		}
	});

	test('freelancer sees assigned projects, borrows tools and asks for advances (KL-6)', () => {
		expect(
			authorizeErpPermissions(['freelancer'], {
				project: ['read'],
				asset_borrowing: ['read', 'create'],
				advance: ['read', 'create'],
			}),
		).toBe(true);
		expect(authorizeErpPermissions(['freelancer'], { project: ['read_cost'] })).toBe(false);
		expect(authorizeErpPermissions(['freelancer'], { advance: ['approve'] })).toBe(false);
	});

	test('warehouse reads purchase and sales orders (B4)', () => {
		expect(authorizeErpPermissions(['warehouse'], { purchase_order: ['read'], sales_order: ['read'] })).toBe(true);
		expect(authorizeErpPermissions(['warehouse'], { purchase_order: ['create'] })).toBe(false);
		expect(authorizeErpPermissions(['warehouse'], { sales_order: ['update'] })).toBe(false);
	});

	test('finance executes payments and enters salary summaries, but has no other HR record access', () => {
		expect(authorizeErpPermissions(['finance'], { payment: ['execute'] })).toBe(true);
		// M08 decision 2026-11-07: HR/finance enter the monthly salary summary,
		// the owner approves it.
		expect(authorizeErpPermissions(['finance'], { payroll: ['read', 'create', 'update'] })).toBe(true);
		expect(authorizeErpPermissions(['finance'], { employee: ['read', 'read_private'] })).toBe(true);
		expect(authorizeErpPermissions(['finance'], { payroll: ['approve'] })).toBe(false);
		expect(authorizeErpPermissions(['finance'], { attendance: ['read'] })).toBe(false);
		expect(authorizeErpPermissions(['finance'], { leave: ['read'] })).toBe(false);
		expect(authorizeErpPermissions(['finance'], { employee: ['create'] })).toBe(false);
	});

	test('hr prepares payroll but cannot approve or execute it', () => {
		expect(authorizeErpPermissions(['hr'], { payroll: ['create', 'calculate', 'submit'] })).toBe(true);
		expect(authorizeErpPermissions(['hr'], { payroll: ['approve'] })).toBe(false);
		expect(authorizeErpPermissions(['hr'], { payroll_payment: ['execute'] })).toBe(false);
	});

	test('hr sees members but neither invites nor cancels invitations (OA12)', () => {
		expect(authorizeErpPermissions(['hr'], { member: ['read'] })).toBe(true);
		expect(authorizeErpPermissions(['hr'], { invitation: ['create'] })).toBe(false);
		expect(authorizeErpPermissions(['hr'], { invitation: ['cancel'] })).toBe(false);
	});

	test('technician has no customer database access', () => {
		expect(authorizeErpPermissions(['technician'], { customer: ['read'] })).toBe(false);
		expect(authorizeErpPermissions(['technician'], { daily_report: ['create'] })).toBe(true);
	});

	test('freelancer has no customer/payroll/margin access', () => {
		expect(authorizeErpPermissions(['freelancer'], { customer: ['read'] })).toBe(false);
		expect(authorizeErpPermissions(['freelancer'], { payroll: ['read'] })).toBe(false);
	});

	test('investor and customer are app roles, not organization roles (ADR-0018)', () => {
		// They hold no organization grant at all, so no ERP permission passes.
		expect(authorizeErpPermissions(['investor'], { investor_portal: ['read_report'] })).toBe(false);
		expect(authorizeErpPermissions(['customer'], { customer_portal: ['create_ticket'] })).toBe(false);
		expect(authorizeErpPermissions(['investor'], { invoice: ['read'] })).toBe(false);
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

// Grants ported from the M02/M05/M07 branch (ADR-0011).
describe('license API keys (PR #100 review)', () => {
	test('every role that manages license API keys can issue and revoke them in Better Auth, and only those', () => {
		for (const role of erpRoleNames) {
			const grants = erpRoleGrants[role] as Record<string, readonly string[] | undefined>;
			const manages = grants.license?.includes('manage_api') ?? false;
			const apiKey = grants.apiKey ?? [];
			expect({ role, issue: apiKey.includes('create') && apiKey.includes('update') }).toEqual({ role, issue: manages });
		}
	});
});

describe('sales, procurement and project grants (ADR-0011)', () => {
	test('cost and bank fields are limited to the roles that need them', () => {
		for (const role of ['owner', 'finance', 'purchasing'] as const) {
			expect(authorizeErpPermissions([role], { product: ['read_cost'] })).toBe(true);
			expect(authorizeErpPermissions([role], { supplier: ['read_bank'] })).toBe(true);
		}
		for (const role of ['sales', 'warehouse', 'technician'] as const) {
			expect(authorizeErpPermissions([role], { product: ['read_cost'] })).toBe(false);
			expect(authorizeErpPermissions([role], { supplier: ['read_bank'] })).toBe(false);
		}
		for (const role of ['owner', 'finance', 'project_manager'] as const) {
			expect(authorizeErpPermissions([role], { project: ['read_cost'] })).toBe(true);
		}
		expect(authorizeErpPermissions(['technician'], { project: ['read_cost'] })).toBe(false);
	});

	test('finance reads deals to bill them but never edits sales documents', () => {
		expect(authorizeErpPermissions(['finance'], { quotation: ['read'], sales_order: ['read'] })).toBe(true);
		expect(authorizeErpPermissions(['finance'], { quotation: ['update'] })).toBe(false);
		expect(authorizeErpPermissions(['finance'], { sales_order: ['create'] })).toBe(false);
	});

	test('project manager runs projects and tickets; technician only works tickets', () => {
		expect(
			authorizeErpPermissions(['project_manager'], {
				project: ['create', 'close'],
				service_ticket: ['assign', 'close'],
				customer: ['read'],
			}),
		).toBe(true);
		expect(authorizeErpPermissions(['technician'], { service_ticket: ['read', 'update', 'resolve'] })).toBe(true);
		expect(authorizeErpPermissions(['technician'], { service_ticket: ['assign'] })).toBe(false);
		expect(authorizeErpPermissions(['technician'], { service_ticket: ['close'] })).toBe(false);
	});

	test('purchasing prepares stock adjustments; operations manager approves them', () => {
		expect(authorizeErpPermissions(['purchasing'], { stock_adjustment: ['create', 'submit'] })).toBe(true);
		expect(authorizeErpPermissions(['purchasing'], { stock_adjustment: ['approve'] })).toBe(false);
		expect(authorizeErpPermissions(['operations_manager'], { stock_adjustment: ['approve', 'post'] })).toBe(true);
	});
});
