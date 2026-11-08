import {
	Bell,
	Building2,
	Contact,
	FileCheck2,
	FileSpreadsheet,
	Globe,
	GraduationCap,
	HandCoins,
	KeyRound,
	LayoutDashboard,
	MessageSquare,
	Package,
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
 * UI-first pass: every module from the docs is present so the shell shows
 * the app's final shape. Modules whose routes do not exist yet render a
 * `ComingSoonPage` stub (see `routes/_authed/**` thin route files), so all
 * items are clickable and navigate to a real (placeholder) page.
 *
 * Permission gating is intentionally absent in this pass; when the shared
 * `erp-permissions` catalog is wired into the sidebar, filter these lists
 * per item instead of hiding whole sections.
 */
export const navSections: { labelKey: SidebarItem['titleKey']; items: SidebarItem[] }[] = [
	// M01 — Dashboard. Plain link; the authed index page doubles as the
	// dashboard placeholder for now.
	{
		labelKey: 'section.dashboard',
		items: [{ titleKey: 'item.dashboard', url: '/', icon: LayoutDashboard }],
	},

	// M02 — CRM & Sales. CRM (relationships) and Sales (transactions) are
	// separate domains with their own route namespaces.
	{
		labelKey: 'section.crmSales',
		items: [
			{
				titleKey: 'item.crm',
				url: '/crm',
				icon: Contact,
				items: [
					{ titleKey: 'item.leads', url: '/crm/leads' },
					{ titleKey: 'item.customers', url: '/crm/customers' },
				],
			},
			{
				titleKey: 'item.sales',
				url: '/sales',
				icon: ReceiptText,
				items: [
					{ titleKey: 'item.quotes', url: '/sales/quotes' },
					{ titleKey: 'item.invoices', url: '/sales/invoices' },
					{ titleKey: 'item.downPayments', url: '/sales/down-payments' },
					{ titleKey: 'item.receipts', url: '/sales/receipts' },
				],
			},
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
					{ titleKey: 'item.apiKeys', url: '/subscription/api-keys' },
					{ titleKey: 'item.activations', url: '/subscription/activations' },
				],
			},
		],
	},

	// M04 — Integrations. Flat items: each integration is its own area, no
	// grouping parent (per plan review).
	{
		labelKey: 'section.integrations',
		items: [
			{ titleKey: 'item.websiteCatalog', url: '/integrations/website-catalog', icon: Globe },
			{ titleKey: 'item.whatsappAi', url: '/integrations/whatsapp-ai', icon: MessageSquare },
			{ titleKey: 'item.notifications', url: '/integrations/notifications', icon: Bell },
			{ titleKey: 'item.webhooks', url: '/integrations/webhooks', icon: Webhook },
		],
	},

	// M05 — Inventory & Purchasing (existing routes + new Procurement),
	// with Assets & Equipment (M06) folded in as its own group.
	{
		labelKey: 'section.inventory',
		items: [
			{ titleKey: 'item.warehouses', url: '/inventory/warehouses', icon: Warehouse },
			{
				titleKey: 'item.items',
				icon: Package,
				items: [
					{ titleKey: 'item.products', url: '/inventory/products' },
					{ titleKey: 'item.components', url: '/inventory/components' },
					{ titleKey: 'item.materials', url: '/inventory/materials' },
					{ titleKey: 'item.stock', url: '/inventory/stock' },
					{ titleKey: 'item.stockAdjustments', url: '/inventory/stock/adjustments' },
					{ titleKey: 'item.newItem', url: '/inventory/items/new' },
				],
			},
			{
				titleKey: 'item.procurement',
				url: '/procurement',
				icon: Truck,
				items: [
					{ titleKey: 'item.suppliers', url: '/procurement/suppliers' },
					{ titleKey: 'item.purchaseOrders', url: '/procurement/purchase-orders' },
					{ titleKey: 'item.goodsReceipts', url: '/procurement/receipts' },
				],
			},
			{
				titleKey: 'item.assets',
				url: '/assets',
				icon: Repeat,
				items: [
					{ titleKey: 'item.borrowings', url: '/assets/borrowings' },
					{ titleKey: 'item.assetRegister', url: '/assets/register' },
					{ titleKey: 'item.serviceRecords', url: '/assets/service-records' },
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
					{ titleKey: 'item.bast', url: '/projects/bast' },
					{ titleKey: 'item.tickets', url: '/projects/tickets' },
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
					{ titleKey: 'item.employees', url: '/hr/employees' },
					{ titleKey: 'item.attendance', url: '/hr/attendance' },
					{ titleKey: 'item.leave', url: '/hr/leave' },
					{ titleKey: 'item.overtime', url: '/hr/overtime' },
					{ titleKey: 'item.payroll', url: '/hr/payroll' },
				],
			},
		],
	},

	// M09 — Finance, with Tax (M10) merged in: the docs have tax recaps
	// reviewed by finance, so Tax is a sibling parent inside this section.
	{
		labelKey: 'section.finance',
		items: [
			{
				titleKey: 'item.finance',
				url: '/finance',
				icon: Wallet,
				items: [
					{ titleKey: 'item.openingBalances', url: '/finance/opening-balances' },
					{ titleKey: 'item.accounts', url: '/finance/accounts' },
					{ titleKey: 'item.journal', url: '/finance/journal' },
					{ titleKey: 'item.cashBank', url: '/finance/cash-bank' },
					{ titleKey: 'item.reconciliation', url: '/finance/reconciliation' },
					{ titleKey: 'item.receivables', url: '/finance/receivables' },
					{ titleKey: 'item.payables', url: '/finance/payables' },
					{ titleKey: 'item.expenses', url: '/finance/expenses' },
					{ titleKey: 'item.financialReports', url: '/finance/reports' },
					{ titleKey: 'item.periodClosing', url: '/finance/closing' },
				],
			},
			{
				titleKey: 'item.tax',
				url: '/finance/tax',
				icon: Scale,
				items: [
					{ titleKey: 'item.taxTypes', url: '/finance/tax/types' },
					{ titleKey: 'item.taxRecords', url: '/finance/tax/records' },
					{ titleKey: 'item.taxRecap', url: '/finance/tax/recap' },
					{ titleKey: 'item.taxWithholding', url: '/finance/tax/withholding' },
					{ titleKey: 'item.taxCorrections', url: '/finance/tax/corrections' },
				],
			},
			{
				// M11 — Investors, merged into Finance per plan review (the
				// docs treat profit-sharing payouts as finance-owned).
				titleKey: 'item.investors',
				url: '/finance/investors',
				icon: HandCoins,
				items: [
					{ titleKey: 'item.investorList', url: '/finance/investors/registry' },
					{ titleKey: 'item.profitSharing', url: '/finance/investors/profit-sharing' },
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
				items: [{ titleKey: 'item.monthlyArchives', url: '/reports/monthly-archives' }],
			},
		],
	},

	// Platform-level account administration (stays separate from M12 per
	// the plan: /admin/* is platform-account admin, not ERP access rights).
	{
		labelKey: 'section.administration',
		items: [
			{ titleKey: 'item.organizations', url: '/organizations', icon: Building2 },
			{ titleKey: 'item.users', url: '/admin/users', icon: Users },
			{ titleKey: 'item.auditLog', url: '/admin/audit', icon: ScrollText },
			{ titleKey: 'item.settings', url: '/admin/settings', icon: Settings },
		],
	},
];
