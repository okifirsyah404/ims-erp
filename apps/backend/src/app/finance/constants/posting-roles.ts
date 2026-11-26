/**
 * Posting-rule vocabulary (ERP-0128, ADR-0030).
 *
 * @remarks
 * A source module names a **role** (what the amount is) and finance resolves
 * the account through `finance.posting_rules`. Roles are application-guarded
 * (no DB check) so each phase can add roles without a migration. Event types
 * name the business fact; `'*'` rules are the per-role defaults.
 */
export const POSTING_ROLES = [
	'receivable',
	'revenue',
	'vat_output',
	'payable',
	'expense',
	'vat_input',
	'inventory',
	'claim_payable',
	// Phase B-D roles, documented now so rules can be configured ahead:
	'customer_advance',
	'deferred_revenue',
	'sales_return',
	'cogs',
	'project_cogs',
	'grir_clearing',
	'cash_receipt',
	'cash_payment',
	'wht_payable',
	'vat_payable',
	'vat_overpaid',
	'pph25_payable',
	'purchase_price_variance',
	'inventory_variance',
	'gateway_clearing',
	'gateway_fee',
	'salary_expense',
	'bpjs_expense',
	'salary_payable',
	'pph21_payable',
	'bpjs_payable',
	'employee_receivable',
	'employee_advance',
	'disposal_receivable',
	'asset_disposal_gain',
	'asset_disposal_loss',
	'fixed_asset',
	'accumulated_depreciation',
	'depreciation_expense',
	'bad_debt_allowance',
	'retained_earnings',
	// ERP-0153: income tax expense, split out by the closed-period profit contract.
	'income_tax_expense',
] as const;
export type TPostingRole = (typeof POSTING_ROLES)[number];

/** Business events that post through `postBusinessEvent`. */
export const POSTING_EVENT_TYPES = [
	'*',
	'sale.invoice_issued',
	'payment.settled',
	'finance.supplier_bill_recorded',
	'finance.expense_claim_approved',
	'finance.deferred_revenue_recognized',
	'finance.credit_memo_applied',
	'finance.receivable_written_off',
	'procurement.goods_received',
	'procurement.purchase_returned',
	'sale.delivery_shipped',
	'sale.return_received',
	'inventory.adjustment_posted',
	'sale.receipt_posted',
	'payment.gateway_settled',
	'project.cost_recorded',
	'payment.withholding_recorded',
	'finance.ppn_settled',
	'finance.tax_paid',
	'payroll.approved',
	'payroll.paid',
	'finance.advance_settled',
	'finance.asset_capitalized',
	'finance.asset_depreciated',
	'finance.asset_disposed',
] as const;
export type TPostingEventType = (typeof POSTING_EVENT_TYPES)[number];

/**
 * Legacy resolver role keys (`ArAccountResolverService`) mapped to posting
 * roles. Kept so the invoice, bill, claim and settlement flows did not change
 * their call sites when the hard-coded codes became seeded rules.
 */
export const LEGACY_ROLE_MAP = {
	ar: 'receivable',
	revenue: 'revenue',
	taxPayable: 'vat_output',
	ap: 'payable',
	expense: 'expense',
	taxInput: 'vat_input',
	inventory: 'inventory',
	claimPayable: 'claim_payable',
	employeeAdvance: 'employee_advance',
} as const satisfies Record<string, TPostingRole>;
export type TLegacyPostingRole = keyof typeof LEGACY_ROLE_MAP;

/** Default account code per role, seeded as `'*'` rules (chart-of-accounts seeder). */
export const DEFAULT_POSTING_RULE_CODES: Partial<Record<TPostingRole, string>> = {
	receivable: '1-1310',
	revenue: '4-1100',
	vat_output: '2-1410',
	payable: '2-1100',
	expense: '6-2900',
	vat_input: '1-1810',
	inventory: '1-1410',
	claim_payable: '2-1200',
	customer_advance: '2-1300',
	deferred_revenue: '2-1500',
	sales_return: '4-1900',
	cogs: '5-1100',
	project_cogs: '5-1200',
	grir_clearing: '2-1150',
	cash_receipt: '1-1120',
	cash_payment: '1-1120',
	wht_payable: '2-1430',
	vat_payable: '2-1460',
	vat_overpaid: '1-1830',
	pph25_payable: '2-1450',
	purchase_price_variance: '5-1300',
	inventory_variance: '5-1400',
	gateway_clearing: '1-1250',
	gateway_fee: '6-3200',
	salary_expense: '6-1100',
	bpjs_expense: '6-1200',
	salary_payable: '2-1600',
	pph21_payable: '2-1420',
	bpjs_payable: '2-1700',
	employee_receivable: '1-1320',
	employee_advance: '1-1340',
	disposal_receivable: '1-1330',
	asset_disposal_gain: '7-2000',
	asset_disposal_loss: '8-2000',
	depreciation_expense: '6-2500',
	fixed_asset: '1-2110',
	accumulated_depreciation: '1-2210',
	bad_debt_allowance: '1-1390',
	retained_earnings: '3-2000',
	income_tax_expense: '8-3000',
};
