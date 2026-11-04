/**
 * Dashboard (M01) copy.
 *
 * @remarks
 * Scoped to what `DashboardPage` renders today. Keys are added with their
 * screen, not ahead of it — `locale-dead-keys.test.ts` fails on any key no
 * component references.
 *
 * The dashboard is currently a dummy view fed by mock data (`dashboard-api.ts`
 * in web-admin), so `banner.sampleData` is mandatory and stays until real
 * endpoints replace the mock fetcher.
 *
 * Widget titles/figures mirror the M01 Stage-1 plan: sales, cash, profit,
 * inventory, projects, subscriptions. Activity messages interpolate `{{code}}`
 * document references from the mock feed.
 */
const dashboard = {
	'banner.sampleData':
		'Sample data — every figure below is a placeholder, not live ERP data.',

	'widget.sales.title': 'Sales',
	'widget.sales.invoicedThisMonth': 'Invoiced this month',
	'widget.sales.invoicedLastMonth': 'Previous month',
	'widget.sales.openQuotes': 'Open quotations',

	'widget.cash.title': 'Cash & Bank',
	'widget.cash.perAccount': 'Balance per account',
	'widget.cash.total': 'Total',

	'widget.profit.title': 'Profit',
	'widget.profit.monthToDate': 'Month to date',
	'widget.profit.provisional': 'Provisional — period not closed',

	'widget.inventory.title': 'Inventory',
	'widget.inventory.itemCount': 'Items',
	'widget.inventory.stockValue': 'Stock value (latest finance summary)',

	'widget.projects.title': 'Projects',
	'widget.projects.byStatus': 'Active projects by status',
	'widget.projects.overdue': 'Past target date',
	'projects.status.planning': 'Planning',
	'projects.status.inProgress': 'In progress',
	'projects.status.done': 'Done',

	'widget.subscriptions.title': 'Subscriptions',
	'widget.subscriptions.endingSoon': 'Ending within 30 days',
	'widget.subscriptions.expired': 'Already expired',

	'chart.title': 'Invoiced sales — last 6 months',
	'chart.monthly': 'Invoiced',

	'activity.title': 'Recent activity',
	'activity.quoted': 'Quotation {{code}} created',
	'activity.invoicePaid': 'Invoice {{code}} paid',
	'activity.stockAdjusted': 'Stock adjusted for {{code}}',
	'activity.projectHandover': 'Project {{code}} handed over (BAST)',

	'quickLinks.title': 'Quick links',

	'action.viewAll': 'View all',
} as const;

export default dashboard;
