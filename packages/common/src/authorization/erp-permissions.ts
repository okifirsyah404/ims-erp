/**
 * ERP permission catalog - the single source of truth for resource/action
 * vocabulary shared by the backend (Better Auth organization access control)
 * and the frontend (UX-only permission checks).
 *
 * Browser-safe: this module must never import server-only code (database,
 * config, Better Auth server instances). The backend composes
 * `createAccessControl` on top of these statements in
 * `apps/backend/src/providers/better-auth/ac/organization-ac.ts`.
 *
 * Deny-by-default: a permission that is not granted explicitly is denied.
 * Adding a resource/action here does not grant it to anyone - role grants
 * live in `apps/common/src/authorization/roles.ts` (also explicit).
 *
 * Note: catalog entries describe the *intended* vocabulary for the whole ERP.
 * Modules that do not exist yet are still registered so routes can be
 * protected consistently as they are built (see security-and-access.md,
 * "integration gaps").
 */

export const erpStatements = {
	// Organization settings
	company_setting: ['read', 'update'],
	branch: ['read', 'create', 'update', 'archive'],
	department: ['read', 'create', 'update', 'archive'],
	master_data: ['read', 'create', 'update', 'archive', 'import', 'export'],
	dashboard: ['read'],

	// Sales and CRM
	customer: ['read', 'create', 'update', 'archive', 'export'],
	lead: ['read', 'create', 'update', 'assign', 'archive', 'export'],
	quotation: ['read', 'create', 'update', 'submit', 'approve', 'reject', 'send', 'export'],
	sales_discount: ['request', 'approve'],
	sales_order: ['read', 'create', 'update', 'submit', 'approve', 'cancel', 'export'],

	// Purchasing
	supplier: ['read', 'create', 'update', 'archive'],
	purchase_request: ['read', 'create', 'update', 'submit', 'approve', 'reject'],
	purchase_order: ['read', 'create', 'update', 'submit', 'approve', 'send', 'cancel', 'export'],

	// Projects and technicians
	project: ['read', 'create', 'update', 'assign', 'close', 'export'],
	task: ['read', 'create', 'update', 'assign', 'submit', 'verify'],
	daily_report: ['read', 'create', 'update', 'submit', 'verify', 'export'],
	kpi: ['read', 'configure', 'evaluate', 'export'],
	advance: ['read', 'create', 'update', 'submit', 'approve', 'reject', 'disburse'],
	settlement: ['read', 'create', 'update', 'submit', 'verify', 'approve', 'reject'],

	// HR and payroll
	employee: ['read', 'create', 'update', 'archive', 'export'],
	employment_contract: ['read', 'create', 'update', 'approve', 'export'],
	attendance: ['read', 'check_in', 'check_out', 'request_correction', 'approve_correction', 'export'],
	leave: ['read', 'create', 'cancel', 'approve', 'reject'],
	disciplinary_record: ['read', 'create', 'update', 'approve'],
	payroll: ['read', 'create', 'calculate', 'update', 'submit', 'approve', 'export'],
	payroll_payment: ['read', 'execute'],
	payslip: ['read', 'publish', 'download'],

	// Inventory
	product: ['read', 'create', 'update', 'archive', 'import', 'export'],
	// Application-admin-only in practice: warehouse routes ride
	// `sessionGuard` + the global-admin policy, never `erpGuard`, because a
	// global warehouse has no organization context. No organization role
	// holds any `warehouse:*` action (ADR-0008). The statement stays in the
	// catalog so the vocabulary is complete and typed.
	warehouse: ['read', 'create', 'update', 'archive'],
	stock: ['read', 'receive', 'issue', 'transfer', 'export'],
	stock_adjustment: ['read', 'create', 'submit', 'approve', 'post'],
	// Borrowing is request/issue separated: `issue` is the act of handing a
	// unit over, `mark_lost` is restricted to owner/admin/operations_manager.
	borrowing: [
		'read',
		'create',
		'update',
		'approve',
		'issue',
		'return',
		'extend',
		'mark_late',
		'mark_lost',
		'export',
	],

	// Finance and accounting
	invoice: ['read', 'create', 'update', 'issue', 'void', 'export'],
	receipt: ['read', 'create', 'verify', 'post', 'reverse', 'export'],
	payment: ['read', 'create', 'submit', 'approve', 'execute', 'reverse', 'export'],
	cash_bank: ['read', 'create', 'update', 'reconcile', 'export'],
	chart_of_account: ['read', 'create', 'update', 'archive'],
	journal: ['read', 'create', 'update', 'submit', 'approve', 'post', 'reverse', 'export'],
	accounting_period: ['read', 'close', 'reopen'],
	tax: ['read', 'create', 'update', 'verify', 'export'],
	financial_report: ['read', 'export'],

	// After-sales and assets
	service_ticket: ['read', 'create', 'update', 'assign', 'resolve', 'close'],
	warranty_claim: ['read', 'create', 'update', 'approve', 'reject', 'close'],
	asset: ['read', 'create', 'update', 'assign', 'return', 'maintain', 'dispose', 'export'],

	// Documents and planning
	document: ['read', 'create', 'update', 'submit', 'approve', 'issue', 'void', 'download'],
	approval_rule: ['read', 'configure'],
	budget: ['read', 'create', 'update', 'submit', 'approve', 'revise', 'export'],
	work_plan: ['read', 'create', 'update', 'approve'],

	// Investor management (internal back office)
	investor: ['read', 'create', 'update', 'archive'],
	capital_commitment: ['read', 'create', 'update', 'approve'],
	capital_deposit: ['read', 'create', 'verify', 'post'],
	fund_allocation: ['read', 'create', 'submit', 'approve'],
	profit_distribution: ['read', 'calculate', 'submit', 'approve', 'pay', 'export'],
	investor_report: ['read', 'create', 'publish', 'export'],

	// Commerce and automation
	web_content: ['read', 'create', 'update', 'publish', 'archive'],
	catalog: ['read', 'create', 'update', 'publish', 'archive'],
	promotion: ['read', 'create', 'update', 'publish', 'archive'],
	commerce_order: ['read', 'update', 'process', 'cancel'],
	automation: ['read', 'create', 'update', 'activate', 'execute', 'read_log'],
	license: ['read', 'create', 'activate', 'extend', 'revoke'],
	integration: ['read', 'configure', 'rotate_secret', 'test'],
	audit_log: ['read', 'export'],
} as const satisfies Record<string, readonly string[]>;

export type ErpResource = keyof typeof erpStatements;

export type ErpAction<R extends ErpResource = ErpResource> =
	(typeof erpStatements)[R][number];

/**
 * Built-in Better Auth organization statement resources (from
 * `defaultStatements`), included so role grants can reference them.
 */
export const builtInOrgStatements = {
	// `create`/`read` extend Better Auth's defaults (update/delete for
	// organization; create/update/delete for member) so first-party admin
	// routes and the org CRUD UI can require list/show permissions.
	organization: ['create', 'read', 'update', 'delete'],
	member: ['create', 'read', 'update', 'delete'],
	invitation: ['create', 'cancel'],
	ac: ['create', 'read', 'update', 'delete'],
} as const satisfies Record<string, readonly string[]>;

/** Restricted portal statement vocabularies (not internal back-office). */export const portalStatements = {
	self_service: [
		'read_profile',
		'update_profile',
		'read_attendance',
		'read_payslip',
		'request_leave',
	],
	customer_portal: [
		'read_project',
		'read_document',
		'read_invoice',
		'create_ticket',
		'read_ticket',
	],
	investor_portal: [
		'read_commitment',
		'read_deposit',
		'read_allocation',
		'read_distribution',
		'read_report',
	],
} as const satisfies Record<string, readonly string[]>;

/** A concrete permission request, e.g. `{ quotation: ['approve'] }`. */
export type ErpPermissionRequest = {
	readonly [R in ErpResource | keyof typeof portalStatements | keyof typeof builtInOrgStatements]?: readonly (R extends ErpResource
		? ErpAction<R>
		: R extends keyof typeof portalStatements
			? (typeof portalStatements)[R][number]
			: R extends keyof typeof builtInOrgStatements
				? (typeof builtInOrgStatements)[R][number]
				: never)[];
};

/**
 * ERP organization role keys. These are *organization* membership roles -
 * completely separate from the global Better Auth `admin`/`user` roles
 * managed by the `admin()` plugin.
 */
export const erpRoleNames = [
	'owner',
	'admin',
	'member',
	'operations_manager',
	'sales_manager',
	'sales',
	'project_manager',
	'technician',
	'freelancer',
	'purchasing',
	'warehouse',
	'finance',
	'accountant',
	'hr',
	'customer_service',
	'marketing',
	'investor',
	'customer',
	'auditor',
] as const;

export type ErpRoleName = (typeof erpRoleNames)[number];

/**
 * Every ERP statement granted to a role that holds all of them (the owner
 * baseline). Typed as `ErpPermissionRequest` so the spread stays assignable
 * to the catalog contract.
 */
const allErpStatements = Object.fromEntries(
	Object.entries(erpStatements).map(([resource, actions]) => [resource, actions]),
) as ErpPermissionRequest;

/**
 * Role grants as plain data (browser-safe). Values are per-resource action
 * lists; unspecified resources are denied.
 *
 * This catalog is the SINGLE grant source for the whole ERP: the server
 * access control (`apps/backend/src/providers/better-auth/ac/organization-ac.ts`),
 * the client access control (`apps/web-admin/src/lib/erp-ac.ts`) and the
 * per-organization role seeder (`apps/backend/database/seeders/seed/
 * organization-roles.seeder.ts`) all read these values - nobody layers
 * role-specific grants on top of them.
 *
 * Built-in Better Auth organization resources (organization/member/
 * invitation/ac) are part of the catalog too, so the dynamic `auth.roles`
 * grant rows (phase 3) can express the same policy.
 *
 * Business separation-of-duties (no self-approval, execution only after
 * approval, amount limits) is enforced server-side in the Elysia
 * authorization layer - permissions alone never bypass those checks.
 */
export const erpRoleGrants: Record<ErpRoleName, ErpPermissionRequest> = {
	owner: {
		...allErpStatements,
		// `warehouse:*` is application-admin-only (ADR-0008): warehouse routes
		// are gated on the global-admin policy, never on an organization
		// permission, so the owner's blanket spread must not pretend
		// otherwise.
		warehouse: [],
		// Full built-in organization administration (owner keeps the ERP
		// owner baseline plus these organization-level statements).
		organization: ['create', 'read', 'update', 'delete'],
		member: ['create', 'read', 'update', 'delete'],
		invitation: ['create', 'cancel'],
	},

	// Organization administration + non-sensitive master data. No payroll,
	// payment execution, accounting, investor-finance, or integration secrets.
	admin: {
		organization: ['read', 'update'],
		member: ['create', 'read', 'update', 'delete'],
		invitation: ['create', 'cancel'],
		ac: ['read'],
		company_setting: ['read', 'update'],
		branch: ['read', 'create', 'update', 'archive'],
		department: ['read', 'create', 'update', 'archive'],
		master_data: ['read', 'create', 'update', 'archive', 'import', 'export'],
		dashboard: ['read'],
		employee: ['read'],
		product: ['read'],
		borrowing: [
			'read',
			'create',
			'update',
			'approve',
			'issue',
			'return',
			'extend',
			'mark_late',
			'mark_lost',
			'export',
		],
		document: ['read', 'create', 'download'],
		approval_rule: ['read'],
		service_ticket: ['read', 'create', 'update', 'assign'],
		asset: ['read'],
		license: ['read'],
		audit_log: ['read'],
	},

	// Minimal baseline. Employee self-service still requires an actual
	// employee relationship (record-level check, enforced server-side).
	member: {
		ac: ['read'],
		dashboard: ['read'],
		master_data: ['read'],
		self_service: ['read_profile', 'update_profile', 'read_attendance', 'read_payslip', 'request_leave'],
	},

	operations_manager: {
		ac: ['read'],
		dashboard: ['read'],
		master_data: ['read'],
		project: ['read', 'create', 'update', 'assign', 'close', 'export'],
		task: ['read', 'create', 'update', 'assign', 'submit', 'verify'],
		daily_report: ['read', 'create', 'update', 'submit', 'verify'],
		kpi: ['read', 'configure', 'evaluate', 'export'],
		budget: ['read', 'create', 'update', 'submit', 'approve', 'export'],
		work_plan: ['read', 'create', 'update', 'approve'],
		advance: ['read', 'approve', 'reject'],
		settlement: ['read', 'verify', 'approve', 'reject'],
		purchase_request: ['read', 'approve', 'reject'],
		purchase_order: ['read', 'approve'],
		employee: ['read'],
		asset: ['read', 'create', 'update', 'assign', 'return', 'maintain', 'export'],
		borrowing: [
			'read',
			'create',
			'update',
			'approve',
			'issue',
			'return',
			'extend',
			'mark_late',
			'mark_lost',
			'export',
		],
		document: ['read', 'download'],
		self_service: ['read_profile', 'update_profile', 'read_attendance', 'read_payslip', 'request_leave'],
	},

	sales_manager: {
		ac: ['read'],
		borrowing: ['read', 'create'],
		dashboard: ['read'],
		master_data: ['read'],
		customer: ['read', 'create', 'update', 'archive', 'export'],
		lead: ['read', 'create', 'update', 'assign', 'archive', 'export'],
		quotation: ['read', 'create', 'update', 'submit', 'approve', 'reject', 'send', 'export'],
		sales_discount: ['request', 'approve'],
		sales_order: ['read', 'create', 'update', 'submit', 'approve', 'cancel', 'export'],
		product: ['read'],
		document: ['read', 'download'],
		self_service: ['read_profile', 'update_profile', 'read_attendance', 'read_payslip', 'request_leave'],
	},

	sales: {
		ac: ['read'],
		borrowing: ['read', 'create'],
		dashboard: ['read'],
		customer: ['read', 'create', 'update'],
		lead: ['read', 'create', 'update'],
		quotation: ['read', 'create', 'update', 'submit', 'send'],
		sales_discount: ['request'],
		sales_order: ['read', 'create', 'update', 'submit'],
		product: ['read'],
		document: ['read', 'download'],
		self_service: ['read_profile', 'update_profile', 'read_attendance', 'read_payslip', 'request_leave'],
	},

	project_manager: {
		ac: ['read'],
		borrowing: ['read', 'create', 'approve'],
		dashboard: ['read'],
		master_data: ['read'],
		project: ['read', 'update', 'assign', 'export'],
		task: ['read', 'create', 'update', 'assign', 'submit', 'verify'],
		daily_report: ['read', 'create', 'update', 'submit', 'verify'],
		kpi: ['read', 'evaluate'],
		settlement: ['read', 'create', 'update', 'submit'],
		purchase_request: ['read', 'create', 'submit'],
		work_plan: ['read', 'create', 'update'],
		document: ['read', 'create', 'submit', 'download'],
		asset: ['read', 'assign'],
		self_service: ['read_profile', 'update_profile', 'read_attendance', 'read_payslip', 'request_leave'],
	},

	technician: {
		ac: ['read'],
		borrowing: ['read', 'create'],
		project: ['read'],
		task: ['read', 'update', 'submit'],
		daily_report: ['read', 'create', 'update', 'submit'],
		advance: ['read', 'create', 'update', 'submit'],
		settlement: ['read', 'create', 'update', 'submit'],
		purchase_request: ['read', 'create', 'submit'],
		document: ['read', 'download'],
		self_service: ['read_profile', 'update_profile', 'read_attendance', 'read_payslip', 'request_leave'],
	},

	// Explicitly assigned work only; record-level scoping keeps customer
	// data, payroll, and margins out of reach.
	freelancer: {
		ac: ['read'],
		task: ['read', 'update', 'submit'],
		daily_report: ['read', 'create', 'update', 'submit'],
		settlement: ['read', 'create', 'update', 'submit'],
		document: ['read', 'download'],
	},

	purchasing: {
		ac: ['read'],
		dashboard: ['read'],
		master_data: ['read'],
		supplier: ['read', 'create', 'update', 'archive'],
		purchase_request: ['read', 'create', 'update', 'submit'],
		purchase_order: ['read', 'create', 'update', 'submit', 'send', 'export'],
		product: ['read'],
		stock: ['read'],
		document: ['read', 'download'],
		self_service: ['read_profile', 'update_profile', 'read_attendance', 'read_payslip', 'request_leave'],
	},

	warehouse: {
		ac: ['read'],
		product: ['read'],
		stock: ['read', 'receive', 'issue', 'transfer', 'export'],
		stock_adjustment: ['read', 'create', 'submit'],
		borrowing: [
			'read',
			'update',
			'issue',
			'return',
			'extend',
			'mark_late',
			'mark_lost',
			'export',
		],
		document: ['read', 'download'],
		self_service: ['read_profile', 'update_profile', 'read_attendance', 'read_payslip', 'request_leave'],
	},

	// Payment execution is limited to approved transactions and enforced
	// transactionally server-side; payroll payment access does not grant
	// broad HR record access.
	finance: {
		ac: ['read'],
		dashboard: ['read'],
		master_data: ['read'],
		invoice: ['read', 'create', 'update', 'issue', 'void', 'export'],
		receipt: ['read', 'create', 'verify', 'post', 'reverse', 'export'],
		payment: ['read', 'create', 'submit', 'approve', 'execute', 'reverse', 'export'],
		cash_bank: ['read', 'create', 'update', 'reconcile', 'export'],
		payroll_payment: ['read', 'execute'],
		financial_report: ['read', 'export'],
		tax: ['read', 'export'],
		stock: ['read'],
		investor: ['read'],
		investor_report: ['read'],
		document: ['read', 'download'],
		self_service: ['read_profile', 'update_profile', 'read_attendance', 'read_payslip', 'request_leave'],
	},

	// Accounting and reporting. No automatic bank-transfer execution.
	accountant: {
		ac: ['read'],
		dashboard: ['read'],
		master_data: ['read'],
		chart_of_account: ['read', 'create', 'update', 'archive'],
		journal: ['read', 'create', 'update', 'submit', 'approve', 'post', 'reverse', 'export'],
		accounting_period: ['read', 'close', 'reopen'],
		tax: ['read', 'create', 'update', 'verify', 'export'],
		financial_report: ['read', 'export'],
		invoice: ['read', 'export'],
		receipt: ['read', 'export'],
		payment: ['read', 'export'],
		cash_bank: ['read', 'reconcile', 'export'],
		investor: ['read'],
		investor_report: ['read', 'create', 'publish', 'export'],
		document: ['read', 'download'],
		self_service: ['read_profile', 'update_profile', 'read_attendance', 'read_payslip', 'request_leave'],
	},

	// Payroll preparation only - approval and payment execution stay
	// separate (owner/finance with the business rules enforced server-side).
	hr: {
		ac: ['read'],
		dashboard: ['read'],
		master_data: ['read'],
		employee: ['read', 'create', 'update', 'archive', 'export'],
		employment_contract: ['read', 'create', 'update', 'approve', 'export'],
		attendance: ['read', 'check_in', 'check_out', 'request_correction', 'approve_correction', 'export'],
		leave: ['read', 'create', 'cancel', 'approve', 'reject'],
		disciplinary_record: ['read', 'create', 'update', 'approve'],
		payroll: ['read', 'create', 'calculate', 'update', 'submit', 'export'],
		payslip: ['read', 'publish', 'download'],
		document: ['read', 'create', 'download'],
		self_service: ['read_profile', 'update_profile', 'read_attendance', 'read_payslip', 'request_leave'],
	},

	customer_service: {
		ac: ['read'],
		borrowing: ['read', 'create'],
		dashboard: ['read'],
		customer: ['read'],
		project: ['read'],
		service_ticket: ['read', 'create', 'update', 'assign', 'resolve', 'close'],
		warranty_claim: ['read', 'create', 'update', 'approve', 'reject', 'close'],
		document: ['read', 'download'],
		self_service: ['read_profile', 'update_profile', 'read_attendance', 'read_payslip', 'request_leave'],
	},

	// No integration secrets; automation execution is deliberately excluded.
	marketing: {
		ac: ['read'],
		dashboard: ['read'],
		web_content: ['read', 'create', 'update', 'publish', 'archive'],
		catalog: ['read', 'create', 'update', 'publish', 'archive'],
		promotion: ['read', 'create', 'update', 'publish', 'archive'],
		commerce_order: ['read', 'update', 'process', 'cancel'],
		automation: ['read', 'read_log'],
		product: ['read'],
		customer: ['read'],
		document: ['read', 'download'],
		self_service: ['read_profile', 'update_profile', 'read_attendance', 'read_payslip', 'request_leave'],
	},

	// Read-only investor portal; "published/shared" record-level checks apply.
	investor: {
		investor_portal: [
			'read_commitment',
			'read_deposit',
			'read_allocation',
			'read_distribution',
			'read_report',
		],
	},

	// Customer portal; scoped to the caller's own customer relationship.
	customer: {
		customer_portal: [
			'read_project',
			'read_document',
			'read_invoice',
			'create_ticket',
			'read_ticket',
		],
	},

	// Read/export only inside an explicitly assigned audit scope; sensitive
	// HR/payroll access still requires explicit scope assignment at the
	// record level. No business mutations.
	auditor: {
		ac: ['read'],
		audit_log: ['read', 'export'],
		company_setting: ['read'],
		branch: ['read'],
		department: ['read'],
		master_data: ['read', 'export'],
		dashboard: ['read'],
		customer: ['read', 'export'],
		lead: ['read', 'export'],
		quotation: ['read', 'export'],
		sales_order: ['read', 'export'],
		supplier: ['read'],
		purchase_request: ['read'],
		purchase_order: ['read', 'export'],
		project: ['read', 'export'],
		task: ['read'],
		daily_report: ['read', 'export'],
		employee: ['read', 'export'],
		attendance: ['read', 'export'],
		product: ['read', 'export'],
		stock: ['read', 'export'],
		borrowing: ['read', 'export'],
		invoice: ['read', 'export'],
		receipt: ['read', 'export'],
		payment: ['read', 'export'],
		cash_bank: ['read', 'export'],
		chart_of_account: ['read'],
		journal: ['read', 'export'],
		accounting_period: ['read'],
		tax: ['read', 'export'],
		financial_report: ['read', 'export'],
		service_ticket: ['read'],
		asset: ['read', 'export'],
		document: ['read', 'download'],
		budget: ['read', 'export'],
		license: ['read'],
	},
} as const satisfies Record<ErpRoleName, ErpPermissionRequest>;
