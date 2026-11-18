import {
	Bell,
	Building2,
	Contact,
	FileCheck2,
	FileSpreadsheet,
	FileText,
	Globe,
	GraduationCap,
	Hash,
	HandCoins,
	KeyRound,
	Calculator,
	LayoutDashboard,
	LayoutTemplate,
	MessageSquare,
	Package,
	PenLine,
	ReceiptText,
	Repeat,
	Scale,
	ScrollText,
	Settings,
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
 * Visibility is declared per item (see `filterNav`):
 * - `permission`: shown when the active organization holds it.
 * - `open`: shown to every logged-in user with an internal role.
 * - `appAdminOnly`: shown to application administrators only.
 * - `warehousePic`: shown to application administrators or to a warehouse
 *   person in charge (ADR-0017). A PIC grant is a table row, not an
 *   organization permission, so it is its own flag.
 * - none of the above: hidden. Used for modules whose permission is not in
 *   the catalog yet (`erpStatements`), so the item cannot be gated honestly.
 */
export const navSections: { labelKey: SidebarItem['titleKey']; items: SidebarItem[] }[] = [
	// M01 - Dashboard.
	{
		labelKey: 'section.dashboard',
		items: [{ titleKey: 'item.dashboard', url: '/', icon: LayoutDashboard, internalRole: true }],
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
					{ titleKey: 'item.leads', url: '/crm/leads', permission: 'lead.read' },
					{ titleKey: 'item.customers', url: '/crm/customers', permission: 'customer.read' },
				],
			},
			{
				titleKey: 'item.sales',
				url: '/sales',
				icon: ReceiptText,
				items: [
					{ titleKey: 'item.quotes', url: '/sales/quotes', permission: 'quotation.read' },
					{ titleKey: 'item.salesOrders', url: '/sales/orders', permission: 'sales_order.read' },
					// Same either-or as `GET /delivery-notes` (the leaf had no permission,
					// so the route guard refused the pages to everyone).
					{ titleKey: 'item.deliveryNotes', url: '/sales/deliveries', anyPermission: ['stock.read', 'sales_order.read'] },
					{ titleKey: 'item.salesReturns', url: '/sales/returns', permission: 'sales_return.read' },
					{ titleKey: 'item.invoices', url: '/sales/invoices', permission: 'invoice.read' },
					// No catalog resource yet: hidden.
					{ titleKey: 'item.downPayments', url: '/sales/down-payments' },
					{ titleKey: 'item.receipts', url: '/sales/receipts', permission: 'receipt.read' },
				],
			},
		],
	},

	// Document registry (ERP-0042). Signatures are gated by the
	// `document.signature_*` actions (ERP-0048/ERP-0049, flow not built yet);
	// templates have no catalog resource yet (ERP-0050): hidden.
	{
		labelKey: 'section.documents',
		items: [
			{ titleKey: 'item.files', url: '/documents/files', icon: FileText, permission: 'document.read' },
			{
				titleKey: 'item.signatures',
				icon: PenLine,
				items: [
					{ titleKey: 'item.documentSignatures', url: '/documents/signatures/documents', permission: 'document.signature_read' },
					{ titleKey: 'item.requestSignature', url: '/documents/signatures/request', permission: 'document.signature_request' },
					{ titleKey: 'item.mySignature', url: '/documents/signatures/mine', permission: 'document.signature_sign' },
				],
			},
			{ titleKey: 'item.templates', url: '/documents/templates', icon: LayoutTemplate },
		],
	},

	// M03 — Subscription & Licensing.
	{
		labelKey: 'section.subscription',
		items: [
			{
				titleKey: 'item.subscription',
				url: '/subscription',
				icon: KeyRound,
				items: [
					{ titleKey: 'item.licenseApplications', url: '/subscription/applications', permission: 'license.read' },
					{ titleKey: 'item.apiKeys', url: '/subscription/api-keys', permission: 'license.manage_api' },
					{ titleKey: 'item.activations', url: '/subscription/activations', permission: 'license.activate' },
				],
			},
		],
	},

	// M04 — Integrations. Flat items.
	{
		labelKey: 'section.integrations',
		items: [
			{ titleKey: 'item.websiteCatalog', url: '/integrations/website-catalog', icon: Globe, permission: 'catalog.read' },
			{ titleKey: 'item.whatsappAi', url: '/integrations/whatsapp-ai', icon: MessageSquare, permission: 'automation.read' },
			{ titleKey: 'item.notifications', url: '/integrations/notifications', icon: Bell, open: true },
			{ titleKey: 'item.webhooks', url: '/integrations/webhooks', icon: Webhook, permission: 'integration.read' },
		],
	},

	// M05 — Inventory & Purchasing, with Assets & Equipment (M06) folded in.
	{
		labelKey: 'section.inventory',
		items: [
			// App admins see every warehouse; a person in charge sees the ones
			// granted to them (ADR-0017, resolved from `/warehouses/mine`).
			{ titleKey: 'item.warehouses', url: '/inventory/warehouses', icon: Warehouse, warehousePic: true },
			{ titleKey: 'item.inventoryValue', url: '/inventory/stock/value', icon: Calculator, permission: 'stock.read' },
			{
				titleKey: 'item.items',
				icon: Package,
				items: [
					{ titleKey: 'item.products', url: '/inventory/products', permission: 'product.read' },
					{ titleKey: 'item.components', url: '/inventory/components', permission: 'product.read' },
					{ titleKey: 'item.materials', url: '/inventory/materials', permission: 'product.read' },
					{ titleKey: 'item.stock', url: '/inventory/stock', permission: 'stock.read' },
					{ titleKey: 'item.stockAdjustments', url: '/inventory/stock/adjustments', permission: 'stock_adjustment.read' },
					// No catalog resource yet: hidden.
					{ titleKey: 'item.itemCategories', url: '/inventory/categories' },
					{ titleKey: 'item.itemMovements', url: '/inventory/stock/movements', permission: 'stock.read' },
				],
			},
			{
				titleKey: 'item.procurement',
				url: '/procurement',
				icon: Truck,
				items: [
					{ titleKey: 'item.suppliers', url: '/procurement/suppliers', permission: 'supplier.read' },
					{ titleKey: 'item.purchaseRequests', url: '/procurement/purchase-requests', permission: 'purchase_request.read' },
					{ titleKey: 'item.purchaseOrders', url: '/procurement/purchase-orders', permission: 'purchase_order.read' },
					// Same grant as `GET /goods-receipts` (ERP-0068: the leaf had none, so
					// the route guard refused the BPB pages to everyone).
					{ titleKey: 'item.goodsReceipts', url: '/procurement/receipts', permission: 'stock.read' },
					{ titleKey: 'item.purchaseReturns', url: '/procurement/purchase-returns', permission: 'purchase_return.read' },
				],
			},
			{
				titleKey: 'item.assets',
				url: '/assets',
				icon: Repeat,
				items: [
					{ titleKey: 'item.borrowings', url: '/assets/borrowings', permission: 'asset_borrowing.read' },
					{ titleKey: 'item.assetRegister', url: '/assets/register', permission: 'asset.read' },
					{ titleKey: 'item.serviceRecords', url: '/assets/service-records', permission: 'asset.read' },
					// No catalog resource yet: hidden.
					{ titleKey: 'item.depreciation', url: '/assets/depreciation' },
				],
			},
		],
	},

	// M07 — Projects & After-sales.
	{
		labelKey: 'section.projects',
		items: [
			{
				titleKey: 'item.projects',
				url: '/projects',
				icon: FileCheck2,
				items: [
					// No catalog resource yet: hidden.
					{ titleKey: 'item.bast', url: '/projects/bast' },
					{ titleKey: 'item.tickets', url: '/projects/tickets', permission: 'service_ticket.read' },
				],
			},
		],
	},

	// M08 — HR & Attendance.
	{
		labelKey: 'section.hr',
		items: [
			{
				titleKey: 'item.hr',
				url: '/hr',
				icon: GraduationCap,
				items: [
					{ titleKey: 'item.employees', url: '/hr/employees', permission: 'employee.read' },
					{ titleKey: 'item.attendance', url: '/hr/attendance', permission: 'attendance.read' },
					{ titleKey: 'item.leave', url: '/hr/leave', permission: 'leave.read' },
					{ titleKey: 'item.overtime', url: '/hr/overtime', permission: 'overtime.read' },
					{ titleKey: 'item.payroll', url: '/hr/payroll', permission: 'payroll.read' },
					{ titleKey: 'item.hrTasks', url: '/hr/tasks', permission: 'task.read' },
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
					// No catalog resource yet: hidden.
					{ titleKey: 'item.openingBalances', url: '/finance/opening-balances' },
					{ titleKey: 'item.accounts', url: '/finance/accounts', permission: 'chart_of_account.read' },
					{ titleKey: 'item.journal', url: '/finance/journal', permission: 'journal.read' },
					{ titleKey: 'item.cashBank', url: '/finance/cash-bank', permission: 'cash_bank.read' },
					{ titleKey: 'item.reconciliation', url: '/finance/reconciliation', permission: 'cash_bank.reconcile' },
					{ titleKey: 'item.receivables', url: '/finance/receivables', permission: 'invoice.read' },
					{ titleKey: 'item.payables', url: '/finance/payables', permission: 'bill.read' },
					{ titleKey: 'item.expenses', url: '/finance/expenses', permission: 'bill.read' },
					{ titleKey: 'item.financialReports', url: '/finance/reports', permission: 'financial_report.read' },
					{ titleKey: 'item.periodClosing', url: '/finance/closing', permission: 'accounting_period.close' },
				],
			},
			{
				titleKey: 'item.tax',
				url: '/finance/tax',
				icon: Scale,
				items: [
					{ titleKey: 'item.taxTypes', url: '/finance/tax/types', permission: 'tax.read' },
					{ titleKey: 'item.taxRecords', url: '/finance/tax/records', permission: 'tax.read' },
					{ titleKey: 'item.taxRecap', url: '/finance/tax/recap', permission: 'tax.read' },
					{ titleKey: 'item.taxWithholding', url: '/finance/tax/withholding', permission: 'tax.read' },
					{ titleKey: 'item.taxCorrections', url: '/finance/tax/corrections', permission: 'tax.read' },
				],
			},
			{
				// M11 — Investors, merged into Finance per plan review.
				titleKey: 'item.investors',
				url: '/finance/investors',
				icon: HandCoins,
				items: [
					{ titleKey: 'item.investorList', url: '/finance/investors/registry', permission: 'investor.read' },
					{ titleKey: 'item.profitSharing', url: '/finance/investors/profit-sharing', permission: 'profit_distribution.read' },
				],
			},
		],
	},

	// M12 — Reports & Access.
	{
		labelKey: 'section.reports',
		items: [
			{
				titleKey: 'item.reports',
				url: '/reports',
				icon: FileSpreadsheet,
				items: [{ titleKey: 'item.monthlyArchives', url: '/reports/monthly-archives', permission: 'financial_report.read' }],
			},
		],
	},

	// Platform-level account administration.
	{
		labelKey: 'section.administration',
		items: [
			{ titleKey: 'item.organizations', url: '/organizations', icon: Building2, permission: 'organization.read' },
			{ titleKey: 'item.users', url: '/admin/users', icon: Users, appAdminOnly: true },
			{ titleKey: 'item.auditLog', url: '/admin/audit', icon: ScrollText, appAdminOnly: true },
		],
	},

	// Company-wide configuration (ADR-0011).
	{
		labelKey: 'section.settings',
		items: [
			{ titleKey: 'item.companyProfile', url: '/settings/company', icon: Settings, permission: 'company.read' },
			{ titleKey: 'item.codeNumbers', url: '/settings/code-numbers', icon: Hash, permission: 'code_number.read' },
			// No catalog resource yet: hidden. The document settings page carries
			// no permission of its own (its values are edited per group), so it
			// stays open like the settings section itself.
			{ titleKey: 'item.documentSettings', url: '/settings/documents', icon: FileText, open: true },
		],
	},
];
