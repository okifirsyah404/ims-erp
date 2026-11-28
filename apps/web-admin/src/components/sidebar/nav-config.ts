import {
	Boxes,
	Building2,
	Calculator,
	CalendarCheck,
	CalendarClock,
	CalendarOff,
	Contact,
	CreditCard,
	FileCheck2,
	FileSpreadsheet,
	FileText,
	Globe,
	HandCoins,
	Hash,
	IdCard,
	KeyRound,
	LayoutDashboard,
	LayoutTemplate,
	ListTodo,
	MessageSquare,
	Package,
	PenLine,
	ReceiptText,
	Scale,
	ScrollText,
	Settings,
	ShieldCheck,
	Ticket,
	Timer,
	Toolbox,
	Truck,
	Users,
	Wallet,
	Warehouse,
	Webhook,
} from 'lucide-react';

import type { SidebarItem } from './sidebar-item';

/**
 * Full ERP navigation map (docs module map M01–M12 + Administration).
 *
 * @remarks
 * Section order is the product's own order, not the M-numbering: Dashboard,
 * CRM & Sales, Finance, Projects, Inventory, Human Resource, Documents,
 * Reports, Integrations, Administration, Settings. Subscription & Licensing
 * (M03) is a leaf inside Projects because it belongs to the same customer
 * engagement. The per-block `M0x —` comments keep the module trace.
 *
 * Visibility is declared per item (see `filterNav`):
 * - `permission`: shown when the active organization holds it.
 * - `open`: shown to every logged-in user with an internal role.
 * - `appAdminOnly`: shown to application administrators only.
 * - `orAppAdmin`: with `permission`, also shown to application administrators.
 * - `warehousePic`: shown to application administrators or to a warehouse
 *   person in charge (ADR-0017). A PIC grant is a table row, not an
 *   organization permission, so it is its own flag.
 * - none of the above: hidden. Used for modules whose permission is not in
 *   the catalog yet (`erpStatements`), so the item cannot be gated honestly.
 */
export const navSections: {
	labelKey: SidebarItem['titleKey'];
	items: SidebarItem[];
}[] = [
	// M01 - Dashboard.
	{
		labelKey: 'section.dashboard',
		items: [
			{
				titleKey: 'item.dashboard',
				url: '/',
				icon: LayoutDashboard,
				internalRole: true,
			},
		],
	},

	// M02 — CRM & Sales.
	{
		labelKey: 'section.crmSales',
		items: [
			{
				titleKey: 'item.crm',
				url: '/crm',
				icon: Contact,
				items: [
					{
						titleKey: 'item.leads',
						url: '/crm/leads',
						permission: 'lead.read',
					},
					{
						titleKey: 'item.customers',
						url: '/crm/customers',
						permission: 'customer.read',
					},
				],
			},
			{
				titleKey: 'item.sales',
				url: '/sales',
				icon: ReceiptText,
				items: [
					{
						titleKey: 'item.quotes',
						url: '/sales/quotes',
						permission: 'quotation.read',
					},
					{
						titleKey: 'item.salesOrders',
						url: '/sales/orders',
						permission: 'sales_order.read',
					},
					// Same either-or as `GET /delivery-notes` (the leaf had no permission,
					// so the route guard refused the pages to everyone).
					{
						titleKey: 'item.deliveryNotes',
						url: '/sales/deliveries',
						anyPermission: ['stock.read', 'sales_order.read'],
					},
					{
						titleKey: 'item.salesReturns',
						url: '/sales/returns',
						permission: 'sales_return.read',
					},
					{
						titleKey: 'item.invoices',
						url: '/sales/invoices',
						permission: 'invoice.read',
					},
					// DP invoices are the same list as `/sales/invoices`, narrowed by
					// `termKind=down_payment`, so they share `invoice.read`.
					{
						titleKey: 'item.downPayments',
						url: '/sales/down-payments',
						permission: 'invoice.read',
					},
					{
						titleKey: 'item.receipts',
						url: '/sales/receipts',
						permission: 'receipt.read',
					},
				],
			},
		],
	},

	// M09 — Finance, with Tax (M10) and Investors (M11) merged in.
	{
		labelKey: 'section.finance',
		items: [
			{
				titleKey: 'item.finance',
				url: '/finance',
				icon: Wallet,
				items: [
					{
						titleKey: 'item.cashBank',
						url: '/finance/cash-bank',
						permission: 'cash_bank.read',
					},
					// The page posts through `/finance/ledger/opening-balances`
					// (`journal:read` / `create` / `post`).
					{
						titleKey: 'item.openingBalances',
						url: '/finance/opening-balances',
						permission: 'journal.read',
					},
					{
						titleKey: 'item.accounts',
						url: '/finance/accounts',
						permission: 'chart_of_account.read',
					},
					{
						titleKey: 'item.journal',
						url: '/finance/journal',
						permission: 'journal.read',
					},
					{
						titleKey: 'item.postingRules',
						url: '/finance/posting-rules',
						permission: 'posting_rule.read',
					},
					{
						titleKey: 'item.costCenters',
						url: '/finance/cost-centers',
						permission: 'cost_center.read',
					},
					{
						titleKey: 'item.projectBudgets',
						url: '/finance/project-budgets',
						permission: 'project.read',
					},
					{
						titleKey: 'item.fixedAssets',
						url: '/finance/fixed-assets',
						permission: 'asset.read',
					},
					{
						titleKey: 'item.reconciliation',
						url: '/finance/reconciliation',
						permission: 'cash_bank.reconcile',
					},
					{
						titleKey: 'item.receivables',
						url: '/finance/receivables',
						permission: 'invoice.read',
					},
					{
						titleKey: 'item.payables',
						url: '/finance/payables',
						permission: 'bill.read',
					},
					{
						titleKey: 'item.expenses',
						url: '/finance/expenses',
						permission: 'expense_claim.read',
					},
					{
						titleKey: 'item.financialReports',
						url: '/finance/reports',
						permission: 'financial_report.read',
					},
					{
						titleKey: 'item.periodClosing',
						url: '/finance/closing',
						permission: 'accounting_period.close',
					},
				],
			},
			{
				titleKey: 'item.tax',
				url: '/finance/tax',
				icon: Scale,
				items: [
					{
						titleKey: 'item.taxTypes',
						url: '/finance/tax/types',
						permission: 'tax.read',
					},
					{
						titleKey: 'item.taxRecords',
						url: '/finance/tax/records',
						permission: 'tax.read',
					},
					{
						titleKey: 'item.taxRecap',
						url: '/finance/tax/recap',
						permission: 'tax.read',
					},
					{
						titleKey: 'item.taxWithholding',
						url: '/finance/tax/withholding',
						permission: 'tax.read',
					},
					{
						titleKey: 'item.taxPph21',
						url: '/finance/tax/pph21',
						permission: 'tax.read',
					},
					{
						titleKey: 'item.taxCorrections',
						url: '/finance/tax/corrections',
						permission: 'tax.read',
					},
				],
			},
			{
				// M11 — Investors, merged into Finance per plan review.
				titleKey: 'item.investors',
				url: '/finance/investors',
				icon: HandCoins,
				items: [
					{
						titleKey: 'item.investorList',
						url: '/finance/investors/registry',
						permission: 'investor.read',
					},
					{
						titleKey: 'item.profitSharing',
						url: '/finance/investors/profit-sharing',
						permission: 'profit_distribution.read',
					},
				],
			},
		],
	},

	// M07 — Projects, with Subscription & Licensing (M03) as a leaf: same
	// customer engagement, so it sits next to Projects/Tickets/Warranty.
	{
		labelKey: 'section.projects',
		items: [
			{
				titleKey: 'item.projects',
				url: '/projects',
				icon: FileCheck2,
				permission: 'project.read',
			},
			{
				titleKey: 'item.tickets',
				url: '/tickets',
				icon: Ticket,
				permission: 'service_ticket.read',
			},
			{
				titleKey: 'item.warranty',
				url: '/warranties',
				icon: ShieldCheck,
				permission: 'project.read',
			},
			{
				titleKey: 'item.subscription',
				url: '/subscription',
				icon: KeyRound,
				items: [
					// The contract list had no menu entry (only dashboard links).
					{
						titleKey: 'item.licenseContracts',
						url: '/subscription',
						permission: 'license.read',
					},
					{
						titleKey: 'item.licenseApplications',
						url: '/subscription/applications',
						permission: 'license.read',
					},
					{
						titleKey: 'item.apiKeys',
						url: '/subscription/api-keys',
						permission: 'license.manage_api',
					},
					{
						titleKey: 'item.activations',
						url: '/subscription/activations',
						// The event log is read with `license:read` on the backend.
						permission: 'license.read',
					},
				],
			},
		],
	},

	// M05 — Inventory & Purchasing, with Assets & Equipment (M06) folded in.
	// Warehouses and the product master are their own modules (ADR-0026) but
	// share this one sidebar group.
	{
		labelKey: 'section.inventory',
		items: [
			// App admins see every warehouse; a person in charge sees the ones
			// granted to them (ADR-0017, resolved from `/warehouses/mine`).
			{
				titleKey: 'item.warehouses',
				url: '/warehouses',
				icon: Warehouse,
				warehousePic: true,
			},
			{
				titleKey: 'item.inventoryValue',
				url: '/inventory/stock/value',
				icon: Calculator,
				// Backend: valuation needs both `stock:read` and `product:read_cost`.
				permission: ['stock.read', 'product.read_cost'],
			},
			// Products are the main master, so they sit beside the group instead of
			// inside it. Detail and edit live under `/products/$productId`.
			{
				titleKey: 'item.products',
				url: '/products',
				icon: Package,
				permission: 'product.read',
			},
			{
				titleKey: 'item.items',
				icon: Boxes,
				items: [
					{
						titleKey: 'item.components',
						url: '/inventory/components',
						permission: 'product.read',
					},
					{
						titleKey: 'item.materials',
						url: '/inventory/materials',
						permission: 'product.read',
					},
					{
						titleKey: 'item.stock',
						url: '/inventory/stock',
						permission: 'stock.read',
					},
					{
						titleKey: 'item.stockAdjustments',
						url: '/inventory/stock/adjustments',
						permission: 'stock_adjustment.read',
					},
					// The backend gates categories with `product:*`, so `product.read` shows them.
					{
						titleKey: 'item.itemCategories',
						url: '/product-categories',
						permission: 'product.read',
					},
					{
						titleKey: 'item.itemMovements',
						url: '/inventory/stock/movements',
						permission: 'stock.read',
					},
				],
			},
			{
				titleKey: 'item.assets',
				url: '/assets',
				icon: Toolbox,
				items: [
					{
						titleKey: 'item.assetRegister',
						url: '/assets/register',
						permission: 'asset.read',
					},
					{
						titleKey: 'item.borrowings',
						url: '/assets/borrowings',
						permission: 'asset_borrowing.read',
					},
					{
						titleKey: 'item.serviceRecords',
						url: '/assets/service-records',
						permission: 'asset.read',
					},
					{
						titleKey: 'item.assetCategories',
						url: '/assets/categories',
						permission: 'asset.read',
					},
					{
						titleKey: 'item.toolSets',
						url: '/assets/tool-sets',
						permission: 'asset.read',
					},
					{
						titleKey: 'item.disposals',
						url: '/assets/disposals',
						permission: 'asset.read',
					},
					// `/finance/depreciations` is guarded by `asset:read`.
					{
						titleKey: 'item.depreciation',
						url: '/assets/depreciation',
						permission: 'asset.read',
					},
				],
			},
			{
				titleKey: 'item.procurement',
				url: '/procurement',
				icon: Truck,
				items: [
					{
						titleKey: 'item.suppliers',
						url: '/procurement/suppliers',
						permission: 'supplier.read',
					},
					{
						titleKey: 'item.purchaseRequests',
						url: '/procurement/purchase-requests',
						permission: 'purchase_request.read',
					},
					{
						titleKey: 'item.purchaseOrders',
						url: '/procurement/purchase-orders',
						permission: 'purchase_order.read',
					},
					// ERP-0165: payment terms, purchase terms and notes reused by POs.
					{
						titleKey: 'item.termTemplates',
						url: '/procurement/term-templates',
						permission: 'purchase_order.read',
					},
					// Same grant as `GET /goods-receipts` (ERP-0068: the leaf had none, so
					// the route guard refused the BPB pages to everyone).
					{
						titleKey: 'item.goodsReceipts',
						url: '/procurement/receipts',
						permission: 'stock.read',
					},
					{
						titleKey: 'item.purchaseReturns',
						url: '/procurement/purchase-returns',
						permission: 'purchase_return.read',
					},
				],
			},
		],
	},

	// M08 — Human Resource: flat items (no collapsible parent, `/hr` redirects
	// to the employee list).
	{
		labelKey: 'section.hr',
		items: [
			{
				titleKey: 'item.employees',
				url: '/hr/employees',
				icon: IdCard,
				permission: 'employee.read',
			},
			{
				titleKey: 'item.hrTasks',
				url: '/hr/tasks',
				icon: ListTodo,
				permission: 'task.read',
			},
			{
				titleKey: 'item.schedule',
				url: '/hr/schedule',
				icon: CalendarClock,
				permission: 'schedule.read',
			},
			{
				titleKey: 'item.attendance',
				url: '/hr/attendance',
				icon: CalendarCheck,
				permission: 'attendance.read',
			},
			{
				titleKey: 'item.leave',
				url: '/hr/leave',
				icon: CalendarOff,
				permission: 'leave.read',
			},
			{
				titleKey: 'item.overtime',
				url: '/hr/overtime',
				icon: Timer,
				permission: 'overtime.read',
			},
			{
				titleKey: 'item.payroll',
				url: '/hr/payroll',
				icon: Wallet,
				permission: 'payroll.read',
			},
		],
	},

	// Document registry (ERP-0042). Signatures are gated by the
	// `document.signature_*` actions (ERP-0048/ERP-0049); templates stay a
	// placeholder page (ERP-0050) but already sit behind `document.read`.
	{
		labelKey: 'section.documents',
		items: [
			{
				titleKey: 'item.files',
				url: '/documents/files',
				icon: FileText,
				permission: 'document.read',
			},
			{
				titleKey: 'item.signatures',
				icon: PenLine,
				items: [
					{
						titleKey: 'item.documentSignatures',
						url: '/documents/signatures/documents',
						permission: 'document.signature_read',
					},
					{
						titleKey: 'item.requestSignature',
						url: '/documents/signatures/request',
						permission: 'document.signature_request',
					},
					{
						titleKey: 'item.mySignature',
						url: '/documents/signatures/mine',
						permission: 'document.signature_sign',
					},
				],
			},
			{
				titleKey: 'item.templates',
				url: '/documents/templates',
				icon: LayoutTemplate,
				permission: 'document.read',
			},
		],
	},

	// M12 — Reports.
	{
		labelKey: 'section.reports',
		items: [
			{
				titleKey: 'item.reports',
				url: '/reports',
				icon: FileSpreadsheet,
				items: [
					{
						titleKey: 'item.monthlyArchives',
						url: '/reports/monthly-archives',
						permission: 'financial_report.read',
					},
				],
			},
		],
	},

	// M04 — Integrations.
	{
		labelKey: 'section.integrations',
		items: [
			{
				titleKey: 'item.websiteCatalog',
				url: '/integrations/website-catalog',
				icon: Globe,
				permission: 'catalog.read',
			},
			{
				titleKey: 'item.whatsappAi',
				url: '/integrations/whatsapp-ai',
				icon: MessageSquare,
				items: [
					// Backend: conversations and the FAQ are read with `whatsapp:read`,
					// so the people meant to answer handed-off chats (customer service,
					// sales manager) see them too.
					{
						titleKey: 'item.conversations',
						url: '/integrations/whatsapp-ai',
						permission: 'whatsapp.read',
					},
					{
						titleKey: 'item.faq',
						url: '/integrations/whatsapp-ai/faq',
						permission: 'whatsapp.read',
					},
				],
			},
			{
				titleKey: 'item.webhooks',
				url: '/integrations/webhooks',
				icon: Webhook,
				// Backend: the outbox log is read with `automation:read_log`.
				permission: 'automation.read_log',
			},
		],
	},

	// Platform-level account administration.
	{
		labelKey: 'section.administration',
		items: [
			{
				titleKey: 'item.users',
				url: '/admin/users',
				icon: Users,
				appAdminOnly: true,
			},
			{
				titleKey: 'item.auditLog',
				url: '/admin/audit',
				icon: ScrollText,
				appAdminOnly: true,
			},
		],
	},

	// Company-wide configuration (ADR-0011).
	{
		labelKey: 'section.settings',
		items: [
			{
				titleKey: 'item.companyProfile',
				url: '/settings/company',
				icon: Settings,
				permission: 'company.read',
			},
			// The company organization profile (M12-2): one organization, so
			// there is no list — and only an application admin or the
			// organization owner may open it.
			{
				titleKey: 'item.organizations',
				url: '/settings/organizations',
				icon: Building2,
				ownerOnly: true,
			},
			// Every `<schema>.code_numberings` on one page. The backend opens it to
			// application admins too (`adminOrErpGuard`), hence `orAppAdmin`.
			{
				titleKey: 'item.codeNumbers',
				url: '/settings/code-numbers',
				icon: Hash,
				permission: 'code_number.read',
				orAppAdmin: true,
			},
			{
				titleKey: 'item.paymentGateways',
				url: '/settings/payment-gateways',
				icon: CreditCard,
				permission: 'payment_gateway.read',
			},
			// The document settings page carries no permission of its own (its
			// values are edited per group), so it stays open like the settings
			// section itself.
			{
				titleKey: 'item.documentSettings',
				url: '/settings/documents',
				icon: FileText,
				open: true,
			},
			// ERP-0120: the payday of the daily payroll draft run; application
			// admins only (the backend uses `appAdminOnly`).
			{
				titleKey: 'item.payrollSettings',
				url: '/settings/payroll',
				icon: Wallet,
				appAdminOnly: true,
			},
		],
	},
];
