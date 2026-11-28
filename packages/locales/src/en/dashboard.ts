/**
 * Dashboard (M01) copy.
 *
 * @remarks
 * Keys are added with their widget, not ahead of it - `locale-dead-keys.test.ts`
 * fails on any key no component references. Figures are real since ERP-0055:
 * every widget reads its source module's endpoint, so there is no sample-data
 * banner any more.
 *
 * Money is formatted by `formatIdr` (always `id-ID`); only labels are
 * translated. Project stage labels live in the `projects` namespace and are
 * reused here.
 */
const dashboard = {
	'title': 'Dashboard',


	'section.finance.title': 'Financial summary',
	'section.finance.description': 'Cash basis: posted cash and bank movements, opening balances excluded.',
	'section.operations.title': 'Operations',
	'section.operations.description': 'Sales, stock, projects and subscriptions.',
	'section.activity.title': 'Activity',

	'kpi.income': 'Income',
	'kpi.outcome': 'Outcome',
	'kpi.net': 'Net cash flow',
	'kpi.period': 'Month to date: {{from}} to {{to}}',
	'kpi.delta': '{{percent}}% vs same days last month',
	'kpi.noBase': 'No figure for the same days last month',
	'kpi.previous': 'Last month: {{amount}}',

	'cashFlowChart.title': 'Income vs outcome',
	'cashFlowChart.rangeLabel': '{{from}} to {{to}} · net {{net}}',

	'empty.noWidgets.title': 'Nothing to show for your role',
	'empty.noWidgets.description': 'Your roles in this organization include no dashboard figure. Use the menu to open the pages you can access.',

	'gate.title': 'No dashboard access',
	'gate.noRole': 'The dashboard needs an internal role in an organization. Ask an organization owner or admin to invite you.',
	'gate.appAdmin': 'You are a platform admin but not a member of any organization. Create an organization (you become its owner) or ask to be added to one.',

	'action.retry': 'Try again',
	'action.viewAll': 'View all',

	// Company organization card (M12-2). The five business figures have their
	// own widgets on real data, so this card stays identity-only.
	'organization.title': 'Organization',
	'organization.description':
		'The company organization. Members and their roles are managed on the Users page.',
	'organization.name': 'Name',
	'organization.code': 'Code',
	'organization.created': 'Created',
	'organization.descriptionLabel': 'Description',

	'error.unavailable': 'This figure is unavailable right now.',
	'empty.noAccounts': 'No cash or bank account yet.',
	'empty.noOrganization': 'Pick an organization in the switcher to see its figures.',

	'widget.sales.title': 'Sales',
	'widget.sales.invoicedThisMonth': 'Invoiced this month',
	'widget.sales.invoicedLastMonth': 'Previous month',
	'widget.sales.invoiceCount': 'Invoices this month',
	'widget.sales.delta': '{{percent}}% vs last month',

	'widget.cash.title': 'Cash & Bank',
	'widget.cash.perAccount': 'Balance per account',
	'widget.cash.total': 'Total',

	'widget.profit.title': 'Profit',
	'widget.profit.monthToDate': 'Month to date',
	'widget.profit.revenue': 'Revenue',
	'widget.profit.expenses': 'Expenses',
	'widget.profit.provisional': 'Provisional - period not closed',

	'widget.inventory.title': 'Inventory',
	'widget.inventory.itemCount': 'Items',
	'widget.inventory.stockValue': 'Stock value',

	'widget.projects.title': 'Projects',
	'widget.projects.byStatus': 'Active projects by stage',
	'widget.projects.active': 'Active',
	'widget.projects.closed': 'Closed',
	'widget.projects.overdue': 'Past target date',
	'widget.projects.attention': 'Late',

	'widget.subscriptions.title': 'Subscriptions',
	'widget.subscriptions.endingSoon': 'Ending within 30 days',
	'widget.subscriptions.expired': 'Already expired',

	'chart.title': 'Invoiced sales',
	'chart.invoiced': 'Invoiced',
	'chart.rangeLabel': '{{from}} to {{to}} · total {{total}}',
	'chart.customPlaceholder': 'Pick a date range',
	'chart.range.14d': '14 days',
	'chart.range.1m': '1 month',
	'chart.range.3m': '3 months',
	'chart.range.6m': '6 months',
	'chart.range.1y': '1 year',
	'chart.range.5y': '5 years',
	'chart.range.custom': 'Custom',

	'activity.title': 'Recent activity',
	'activity.invoiceIssued': 'Invoice {{code}} issued',
	'activity.receiptRecorded': 'Receipt {{code}} recorded',
	'activity.empty': 'No invoice or receipt yet.',

	'quickLinks.title': 'Quick links',
} as const;

export default dashboard;
