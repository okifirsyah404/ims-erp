import type {
	TApiPaginatedResponse,
	TApiResponse,
	TPaginationMeta,
} from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { organizationHeaders } from './organization-store';

/**
 * API client for the finance module (ADR-0024: accounting was absorbed into
 * finance). Routes: `/finance/ledger/{accounts,journal,opening-balances}`,
 * `/finance/periods`, `/finance/cash-bank-{accounts,transactions}`,
 * `/finance/supplier-bills*`, `/finance/expenses*`, `/finance/{ar,ap}/aging`,
 * `/finance/reports/*`,
 * `/finance/close/*`, `/finance/reconciliations*` (depreciation entries live in
 * `asset-api`).
 * The payment functions below still point at the payment module's routes and
 * are owned by the payment slice.
 *
 * @remarks
 * Tenant scope is decided by the backend from the `x-organization-id` header
 * (the caller's active organization, sent by `organizationHeaders()`), falling
 * back to the session value. `chart_of_account:*`, `journal:*`,
 * `accounting_period:*`, `cash_bank:*`, `payment:*`, `bill:*` and
 * `financial_report:*` permissions gate every call server-side; the UI only
 * hides controls it knows will fail. Money fields are exact integer minor units
 * (rupiah x 100).
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type TPaginated<T> = { rows: T[]; pagination: TPaginationMeta };

async function request<T>(
	path: string,
	init?: RequestInit,
): Promise<TApiResponse<T>> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers: {
			...organizationHeaders(),
			...(init?.body != null ? { 'Content-Type': 'application/json' } : {}),
		},
		...init,
	});
	const envelope = (await response.json()) as TApiResponse<T>;
	if (!response.ok) {
		throw new Error(
			envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed',
		);
	}
	return envelope;
}

async function getData<T>(path: string): Promise<T> {
	const envelope = await request<T>(path);
	return envelope.data as T;
}

async function sendData<T>(
	path: string,
	method: 'POST' | 'PATCH' | 'DELETE',
	body?: unknown,
): Promise<T> {
	const envelope = await request<T>(path, {
		method,
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	return envelope.data as T;
}

async function getDataPaginated<T>(path: string): Promise<TPaginated<T>> {
	const envelope = (await request<T[]>(path)) as TApiPaginatedResponse<T>;
	return { rows: envelope.data, pagination: envelope.pagination };
}

/** Formats integer minor units as a plain number string for form inputs. */
export const toMajorInput = (minor: number | null | undefined) =>
	minor == null ? '' : String(minor / 100);

/** Parses a user-entered major-unit string into exact integer minor units. */
export const toMinor = (value: string): number =>
	value.trim() === ''
		? 0
		: Math.round(Number.parseFloat(value.replace(',', '.')) * 100);

/* ------------------------- chart of accounts (F2) ------------------------- */

export const ACCOUNT_TYPES = [
	'asset',
	'liability',
	'equity',
	'revenue',
	'expense',
] as const;
export type TAccountType = (typeof ACCOUNT_TYPES)[number];

export const NORMAL_BALANCES = ['debit', 'credit'] as const;

export const CASH_FLOW_CATEGORIES = [
	'operating',
	'investing',
	'financing',
] as const;
export type TCashFlowCategory = (typeof CASH_FLOW_CATEGORIES)[number];

export type TAccount = {
	id: string;
	organizationId: string | null;
	code: string;
	name: string;
	accountType: TAccountType;
	normalBalance: 'debit' | 'credit';
	parentAccountId: string | null;
	level: number;
	isPostable: boolean;
	isSystem: boolean;
	isActive: boolean;
	cashFlowCategory: TCashFlowCategory | null;
	description: string | null;
};

export function accountsQueryOptions(params: {
	page: number;
	limit: number;
	accountType?: TAccountType;
	isActive?: boolean;
	isPostable?: boolean;
	search?: string;
}) {
	const search = new URLSearchParams({
		page: String(params.page),
		limit: String(params.limit),
	});
	if (params.accountType) search.set('accountType', params.accountType);
	if (params.isActive !== undefined)
		search.set('isActive', String(params.isActive));
	if (params.isPostable !== undefined)
		search.set('isPostable', String(params.isPostable));
	if (params.search) search.set('search', params.search);
	return queryOptions({
		queryKey: ['accounts', params],
		queryFn: () => getDataPaginated<TAccount>(`/finance/ledger/accounts?${search}`),
	});
}

export function createAccount(input: {
	code: string;
	name: string;
	accountType: TAccountType;
	normalBalance: 'debit' | 'credit';
	parentAccountId?: string | null;
	isPostable?: boolean;
	cashFlowCategory?: TCashFlowCategory | null;
	description?: string | null;
}) {
	return sendData<TAccount>('/finance/ledger/accounts', 'POST', input);
}

export function updateAccount(
	id: string,
	input: Partial<{
		name: string;
		isPostable: boolean;
		isActive: boolean;
		cashFlowCategory: TCashFlowCategory | null;
		description: string | null;
	}>,
) {
	return sendData<TAccount>(`/finance/ledger/accounts/${id}`, 'PATCH', input);
}

export function archiveAccount(id: string) {
	return sendData<{ removed: boolean }>(`/finance/ledger/accounts/${id}`, 'DELETE');
}

/* --------------------------- accounting periods --------------------------- */

export type TPeriod = {
	id: string;
	organizationId: string | null;
	code: string;
	periodYear: number;
	periodMonth: number;
	startDate: string;
	endDate: string;
	status: 'open' | 'closed' | 'locked';
	closedBy: string | null;
	closedAt: string | null;
	reopenedBy: string | null;
	reopenedAt: string | null;
};

export function periodsQueryOptions(params: { page: number; limit: number }) {
	return queryOptions({
		queryKey: ['periods', params],
		queryFn: () =>
			getDataPaginated<TPeriod>(`/finance/periods?page=${params.page}&limit=${params.limit}`),
	});
}

export function ensurePeriod(periodYear: number, periodMonth: number) {
	return sendData<TPeriod>('/finance/periods', 'POST', { periodYear, periodMonth });
}

export function transitionPeriod(
	id: string,
	to: 'closed' | 'locked' | 'open',
	reason?: string | null,
) {
	return sendData<TPeriod>(`/finance/periods/${id}/transition`, 'POST', { to, reason: reason ?? null });
}

/* ----------------------------- journal (F2) ------------------------------- */

export type TJournalLine = {
	id: string;
	journalEntryId: string;
	lineNo: number;
	accountId: string;
	debit: number;
	credit: number;
	description: string | null;
	costCenterId?: string | null;
};

/** Manual journal lifecycle (ERP-0129); system journals are `posted` directly. */
export const JOURNAL_STATUSES = ['draft', 'submitted', 'approved', 'posted', 'reversed', 'void'] as const;
export type TJournalStatus = (typeof JOURNAL_STATUSES)[number];

export type TJournalEntry = {
	id: string;
	organizationId: string | null;
	/** Assigned at posting; null for draft/submitted/void manual entries. */
	code: string | null;
	accountingPeriodId: string;
	entryDate: string;
	/** Posting module: finance | sale | procurement | inventory | payment | tax | human_resource. */
	sourceModule: string;
	sourceType: string | null;
	sourceId: string | null;
	description: string | null;
	status: TJournalStatus;
	totalDebit: number;
	totalCredit: number;
	reversedByEntryId: string | null;
	reversesEntryId: string | null;
	idempotencyKey: string | null;
	eventType: string | null;
	isAdjusting: boolean;
	preparedBy: string | null;
	approvedBy: string | null;
	lines?: TJournalLine[];
};

export function journalQueryOptions(params: {
	page: number;
	limit: number;
	status?: string;
	year?: number;
	month?: number;
}) {
	const search = new URLSearchParams({
		page: String(params.page),
		limit: String(params.limit),
	});
	if (params.status) search.set('status', params.status);
	if (params.year != null) search.set('year', String(params.year));
	if (params.month != null) search.set('month', String(params.month));
	return queryOptions({
		queryKey: ['journal', params],
		queryFn: () => getDataPaginated<TJournalEntry>(`/finance/ledger/journal?${search}`),
	});
}

export function journalEntryQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['journal', id],
		queryFn: () => getData<TJournalEntry>(`/finance/ledger/journal/${id}`),
	});
}

export type TJournalDraftInput = {
	entryDate: string;
	description?: string | null;
	isAdjusting: boolean;
	lines: Array<{
		accountId: string;
		debit: number;
		credit: number;
		description?: string | null;
		costCenterId?: string | null;
	}>;
};

/** Creates a draft manual entry (maker). */
export function createJournalDraft(input: TJournalDraftInput) {
	return sendData<TJournalEntry>('/finance/ledger/journal', 'POST', input);
}

export function updateJournalDraft(id: string, input: TJournalDraftInput) {
	return sendData<TJournalEntry>(`/finance/ledger/journal/${id}`, 'PATCH', input);
}

export function submitJournalEntry(id: string) {
	return sendData<TJournalEntry>(`/finance/ledger/journal/${id}/submit`, 'POST');
}

/** Approves and posts; the server refuses the preparer (maker-checker). */
export function approveJournalEntry(id: string) {
	return sendData<TJournalEntry>(`/finance/ledger/journal/${id}/approve`, 'POST');
}

export function rejectJournalEntry(id: string, reason: string) {
	return sendData<TJournalEntry>(`/finance/ledger/journal/${id}/reject`, 'POST', { reason });
}

export function voidJournalEntry(id: string) {
	return sendData<TJournalEntry>(`/finance/ledger/journal/${id}/void`, 'POST');
}

/** Reverses a posted entry; the reason is mandatory (ERP-0129). */
export function reverseJournalEntry(id: string, input: { reason: string; entryDate?: string }) {
	return sendData<TJournalEntry>(`/finance/ledger/journal/${id}/reverse`, 'POST', input);
}

/* ----------------------------- cost centres (ERP-0127) ----------------------------- */

export type TCostCenter = {
	id: string;
	code: string;
	name: string;
	parentCostCenterId: string | null;
	isActive: boolean;
	description: string | null;
};

export function costCentersQueryOptions(params: { page: number; limit: number; search?: string; isActive?: boolean }) {
	const search = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
	if (params.search) search.set('search', params.search);
	if (params.isActive !== undefined) search.set('isActive', String(params.isActive));
	return queryOptions({
		queryKey: ['cost-centers', params],
		queryFn: () => getDataPaginated<TCostCenter>(`/finance/cost-centers?${search}`),
	});
}

export type TCostCenterInput = {
	code: string;
	name: string;
	parentCostCenterId: string | null;
	description: string | null;
};

export function createCostCenter(input: TCostCenterInput) {
	return sendData<TCostCenter>('/finance/cost-centers', 'POST', input);
}

export function updateCostCenter(id: string, input: Partial<Omit<TCostCenterInput, 'code'>> & { isActive?: boolean }) {
	return sendData<TCostCenter>(`/finance/cost-centers/${id}`, 'PATCH', input);
}

export function archiveCostCenter(id: string) {
	return sendData<TCostCenter>(`/finance/cost-centers/${id}`, 'DELETE');
}

/* ----------------------------- posting rules (ERP-0128) ----------------------------- */

/** Mirrors `POSTING_ROLES` in the backend (`constants/posting-roles.ts`). */
export const POSTING_ROLES = [
	'receivable',
	'revenue',
	'vat_output',
	'payable',
	'expense',
	'vat_input',
	'inventory',
	'claim_payable',
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
	'fixed_asset',
	'accumulated_depreciation',
	'depreciation_expense',
	'bad_debt_allowance',
	'retained_earnings',
] as const;
export type TPostingRole = (typeof POSTING_ROLES)[number];

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
] as const;
export type TPostingEventType = (typeof POSTING_EVENT_TYPES)[number];

export const POSTING_DISCRIMINATORS = [
	'',
	'product_category',
	'tax',
	'cash_bank_account',
	'expense_category',
	'asset_category',
	'cost_category',
	'payment_method',
] as const;
export type TPostingDiscriminator = (typeof POSTING_DISCRIMINATORS)[number];

export type TPostingRule = {
	id: string;
	eventType: TPostingEventType;
	role: TPostingRole;
	discriminatorType: TPostingDiscriminator;
	discriminatorValue: string;
	accountId: string;
	isActive: boolean;
	description: string | null;
};

export function postingRulesQueryOptions(params: { includeInactive?: boolean } = {}) {
	const search = new URLSearchParams();
	if (params.includeInactive) search.set('includeInactive', 'true');
	return queryOptions({
		queryKey: ['posting-rules', params],
		queryFn: () => getData<TPostingRule[]>(`/finance/posting-rules?${search}`),
	});
}

export type TPostingRuleInput = {
	eventType: TPostingEventType;
	role: TPostingRole;
	discriminatorType: TPostingDiscriminator;
	discriminatorValue: string;
	accountId: string;
	description: string | null;
};

export function createPostingRule(input: TPostingRuleInput) {
	return sendData<TPostingRule>('/finance/posting-rules', 'POST', input);
}

export function updatePostingRule(id: string, input: { accountId?: string; isActive?: boolean; description?: string | null }) {
	return sendData<TPostingRule>(`/finance/posting-rules/${id}`, 'PATCH', input);
}

export function archivePostingRule(id: string) {
	return sendData<TPostingRule>(`/finance/posting-rules/${id}`, 'DELETE');
}

/* ----------------------------- ledger reports (ERP-0133) ----------------------------- */

export type TTrialBalanceRow = {
	accountId: string;
	code: string;
	name: string;
	accountType: TAccountType;
	normalBalance: 'debit' | 'credit';
	openingDebit: number;
	openingCredit: number;
	periodDebit: number;
	periodCredit: number;
	closingDebit: number;
	closingCredit: number;
};

export type TTrialBalance = {
	startDate: string;
	endDate: string;
	rows: TTrialBalanceRow[];
	totals: Omit<TTrialBalanceRow, 'accountId' | 'code' | 'name' | 'accountType' | 'normalBalance'>;
	balanced: boolean;
};

export function trialBalanceQueryOptions(startDate: string, endDate: string) {
	return queryOptions({
		queryKey: ['trial-balance', startDate, endDate],
		queryFn: () => getData<TTrialBalance>(`/finance/reports/trial-balance?startDate=${startDate}&endDate=${endDate}`),
	});
}

export type TGeneralLedgerLine = {
	entryId: string;
	entryCode: string | null;
	entryDate: string;
	sourceModule: string;
	sourceType: string | null;
	description: string | null;
	debit: number;
	credit: number;
	balance: number;
};

export type TGeneralLedger = {
	account: { id: string; code: string; name: string; normalBalance: 'debit' | 'credit' };
	startDate: string;
	endDate: string;
	openingBalance: number;
	lines: TGeneralLedgerLine[];
	totalDebit: number;
	totalCredit: number;
	closingBalance: number;
};

export function generalLedgerQueryOptions(accountId: string, startDate: string, endDate: string) {
	return queryOptions({
		queryKey: ['general-ledger', accountId, startDate, endDate],
		queryFn: () =>
			getData<TGeneralLedger>(
				`/finance/reports/general-ledger?accountId=${accountId}&startDate=${startDate}&endDate=${endDate}`,
			),
	});
}

/* ------------------------ opening balances (F3) --------------------------- */

export type TOpeningBalanceRow = {
	id: string;
	accountId: string;
	asOfDate: string;
	debitBalance: number;
	creditBalance: number;
	description: string | null;
	postedAt: string | null;
};

export function openingBalancesQueryOptions() {
	return queryOptions({
		queryKey: ['opening-balances'],
		queryFn: () => getData<TOpeningBalanceRow[]>('/finance/ledger/opening-balances'),
	});
}

export function addOpeningBalanceRow(input: {
	accountId: string;
	asOfDate: string;
	debitBalance: number;
	creditBalance: number;
	description?: string | null;
}) {
	return sendData<TOpeningBalanceRow>('/finance/ledger/opening-balances', 'POST', input);
}

export function updateOpeningBalanceRow(
	id: string,
	input: Partial<{
		debitBalance: number;
		creditBalance: number;
		description: string | null;
	}>,
) {
	return sendData<TOpeningBalanceRow>(`/finance/ledger/opening-balances/${id}`, 'PATCH', input);
}

export function removeOpeningBalanceRow(id: string) {
	return sendData<{ removed: boolean }>(`/finance/ledger/opening-balances/${id}`, 'DELETE');
}

export function postOpeningBalances() {
	return sendData<{ entryId: string }>('/finance/ledger/opening-balances/post', 'POST');
}

/* --------------------------- cash & bank (F3) ----------------------------- */

export type TCashBankAccount = {
	id: string;
	organizationId: string | null;
	code: string;
	name: string;
	accountType: string;
	bankName: string | null;
	bankCode: string | null;
	branchName: string | null;
	accountNumber: string | null;
	accountHolder: string | null;
	openingBalance: number;
	currentBalance: number;
	currencyCode: string;
	/** Account printed on invoices with VAT (`vat`) or without (`non_vat`). */
	invoiceUsage: 'vat' | 'non_vat' | null;
	isPrimary: boolean;
	isActive: boolean;
	/** Linked `chart_of_accounts` row; `null` until the account is linked. */
	glAccountId: string | null;
};

export type TCashBankTransaction = {
	id: string;
	code: string;
	cashBankAccountId: string;
	transactionDate: string;
	direction: 'in' | 'out';
	amount: number;
	balanceAfter: number;
	description: string | null;
	referenceNumber: string | null;
};

export function cashBankAccountsQueryOptions() {
	return queryOptions({
		queryKey: ['cash-bank-accounts'],
		queryFn: () => getData<TCashBankAccount[]>('/finance/cash-bank-accounts'),
	});
}

export function createCashBankAccount(input: {
	code: string;
	name: string;
	accountType: string;
	bankName?: string | null;
	accountNumber?: string | null;
	accountHolder?: string | null;
	invoiceUsage?: 'vat' | 'non_vat' | null;
	isPrimary?: boolean;
	openingBalance?: number;
	glAccountId?: string | null;
}) {
	return sendData<TCashBankAccount>('/finance/cash-bank-accounts', 'POST', input);
}

export function updateCashBankAccount(
	id: string,
	input: Partial<{
		name: string;
		bankName: string | null;
		accountNumber: string | null;
		accountHolder: string | null;
		invoiceUsage: 'vat' | 'non_vat' | null;
		isPrimary: boolean;
		isActive: boolean;
		glAccountId: string | null;
	}>,
) {
	return sendData<TCashBankAccount>(`/finance/cash-bank-accounts/${id}`, 'PATCH', input);
}

export function cashBankTransactionsQueryOptions(params: {
	page: number;
	limit: number;
	cashBankAccountId?: string;
}) {
	const search = new URLSearchParams({
		page: String(params.page),
		limit: String(params.limit),
	});
	if (params.cashBankAccountId)
		search.set('cashBankAccountId', params.cashBankAccountId);
	return queryOptions({
		queryKey: ['cash-bank-transactions', params],
		queryFn: () =>
			getDataPaginated<TCashBankTransaction>(`/finance/cash-bank-transactions?${search}`),
	});
}

export function postCashBankMovement(input: {
	cashBankAccountId: string;
	transactionDate: string;
	direction: 'in' | 'out';
	amount: number;
	description?: string | null;
	referenceNumber?: string | null;
	counterpartAccountId: string;
}) {
	return sendData<TCashBankTransaction>('/finance/cash-bank-transactions', 'POST', input);
}

/* --------------------------- payments (F4/F5) ----------------------------- */

export type TPayment = {
	id: string;
	code: string;
	paymentType: 'customer_payment' | 'supplier_payment';
	direction: 'in' | 'out';
	counterpartyType: string | null;
	counterpartyId: string | null;
	amount: number;
	currencyCode: string;
	paymentMethod: string;
	paymentDate: string | null;
	status: 'draft' | 'submitted' | 'approved' | 'executed' | 'void';
	cashBankAccountId: string | null;
	referenceNumber: string | null;
	notes: string | null;
	voidedAt: string | null;
	voidReason: string | null;
};

export type TPaymentAllocation = {
	id: string;
	paymentId: string;
	targetType: string;
	salesInvoiceId: string | null;
	supplierBillId: string | null;
	amount: number;
};

export function paymentsQueryOptions(params: {
	page: number;
	limit: number;
	status?: string;
	paymentType?: string;
}) {
	const search = new URLSearchParams({
		page: String(params.page),
		limit: String(params.limit),
	});
	if (params.status) search.set('status', params.status);
	if (params.paymentType) search.set('paymentType', params.paymentType);
	return queryOptions({
		queryKey: ['payments', params],
		queryFn: () => getDataPaginated<TPayment>(`/payments?${search}`),
	});
}

export function paymentQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['payments', id],
		queryFn: () => getData<TPayment>(`/payments/${id}`),
	});
}

export function paymentAllocationsQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['payments', id, 'allocations'],
		queryFn: () => getData<TPaymentAllocation[]>(`/payments/${id}/allocations`),
	});
}

export function createPayment(input: Record<string, unknown>) {
	return sendData<TPayment>('/payments', 'POST', input);
}

export function setPaymentAllocations(
	id: string,
	allocations: Array<{
		salesInvoiceId?: string;
		supplierBillId?: string;
		amount: number;
	}>,
) {
	return sendData<TPayment>(`/payments/${id}/allocations`, 'POST', { allocations });
}

export const submitPayment = (id: string) =>
	sendData<TPayment>(`/payments/${id}/submit`, 'POST');
export const approvePayment = (id: string) =>
	sendData<TPayment>(`/payments/${id}/approve`, 'POST');
export const executePayment = (id: string) =>
	sendData<TPayment>(`/payments/${id}/execute`, 'POST');
export const voidPayment = (id: string, reason: string) =>
	sendData<TPayment>(`/payments/${id}/void`, 'POST', { reason });
export const voidExecutedPayment = (id: string, reason: string) =>
	sendData<TPayment>(`/payments/${id}/void-executed`, 'POST', { reason });

/* ------------------------- supplier bills (F5) ---------------------------- */

export type TSupplierBill = {
	id: string;
	code: string;
	supplierCompanyId: string | null;
	purchaseOrderId: string | null;
	supplierInvoiceNumber: string | null;
	billDate: string | null;
	dueDate: string | null;
	subtotal: number;
	taxTotal: number;
	grandTotal: number;
	paidTotal: number;
	outstandingTotal: number;
	currencyCode: string;
	status: 'draft' | 'approved' | 'partially_paid' | 'paid' | 'overdue' | 'void';
	notes: string | null;
};

/** A line of a supplier bill, as returned in the bill detail. */
export type TSupplierBillItem = {
	id: string;
	supplierBillId: string;
	purchaseOrderItemId: string | null;
	productId: string | null;
	name: string;
	unit: string;
	quantity: string;
	unitPrice: number;
	lineTotal: number;
	taxBase: number;
	isStock: boolean;
	sortOrder: number;
};

export type TSupplierBillDetail = TSupplierBill & { items: TSupplierBillItem[] };

export function billQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['bills', id],
		queryFn: () => getData<TSupplierBillDetail>(`/finance/supplier-bills/${id}`),
	});
}

export function billsQueryOptions(params: {
	page: number;
	limit: number;
	status?: string;
	supplierCompanyId?: string;
}) {
	const search = new URLSearchParams({
		page: String(params.page),
		limit: String(params.limit),
	});
	if (params.status) search.set('status', params.status);
	if (params.supplierCompanyId)
		search.set('supplierCompanyId', params.supplierCompanyId);
	return queryOptions({
		queryKey: ['bills', params],
		queryFn: () => getDataPaginated<TSupplierBill>(`/finance/supplier-bills?${search}`),
	});
}

export function createBill(input: {
	supplierCompanyId: string;
	purchaseOrderId?: string | null;
	billDate: string;
	dueDate?: string | null;
	subtotal: number;
	taxTotal: number;
	currencyCode?: string;
	notes?: string | null;
}) {
	return sendData<TSupplierBill>('/finance/supplier-bills', 'POST', input);
}

/** A purchase order with received goods, as Finance bills it (ERP-0012). */
export type TBillableOrder = {
	id: string;
	code: string | null;
	subject: string;
	status: string;
	supplierCompanyId: string | null;
	supplierName: string;
	vatMode: 'none' | 'included' | 'added';
	vatRateBps: number;
	lines: {
		id: string;
		productId: string | null;
		sku: string;
		name: string;
		unit: string;
		unitPrice: number;
		quantityReceived: string;
		quantityBilled: string;
		quantityBillable: string;
		isStock: boolean;
	}[];
};

export function billableOrdersQueryOptions() {
	return queryOptions({
		queryKey: ['bills', 'billable-orders'],
		queryFn: () => getData<TBillableOrder[]>('/finance/supplier-bills/billable-orders'),
	});
}

export function createBillFromOrder(input: {
	purchaseOrderId: string;
	supplierInvoiceNumber: string;
	billDate: string;
	dueDate: string | null;
	lines: { purchaseOrderItemId: string; quantity: string }[];
}) {
	return sendData<TSupplierBill>('/finance/supplier-bills/from-purchase-order', 'POST', input);
}

export const cancelBill = (id: string) =>
	sendData<TSupplierBill>(`/finance/supplier-bills/${id}/cancel`, 'POST');
export const recordBill = (id: string) =>
	sendData<TSupplierBill>(`/finance/supplier-bills/${id}/record`, 'POST');

/* ---------------------------- aging (F4/F5) ------------------------------- */

export const AGING_BUCKETS = [
	'current',
	'd1_30',
	'd31_60',
	'd61_90',
	'd90plus',
] as const;
export type TAgingBucket = (typeof AGING_BUCKETS)[number];

export type TAgingResponse = {
	asOfDate: string;
	buckets: readonly TAgingBucket[];
	rows: Array<{
		customerId?: string | null;
		supplierCompanyId?: string | null;
		buckets: Record<TAgingBucket, number>;
		total: number;
	}>;
	grandTotal: number;
};

export function arAgingQueryOptions(asOfDate?: string, customerId?: string) {
	const search = new URLSearchParams();
	if (asOfDate) search.set('asOfDate', asOfDate);
	if (customerId) search.set('customerId', customerId);
	const query = search.toString();
	return queryOptions({
		queryKey: ['ar-aging', asOfDate ?? 'today', customerId ?? 'all'],
		queryFn: () =>
			getData<TAgingResponse>(`/finance/ar/aging${query ? `?${query}` : ''}`),
	});
}

export function apAgingQueryOptions(asOfDate?: string, supplierCompanyId?: string) {
	const search = new URLSearchParams();
	if (asOfDate) search.set('asOfDate', asOfDate);
	if (supplierCompanyId) search.set('supplierCompanyId', supplierCompanyId);
	const query = search.toString();
	return queryOptions({
		queryKey: ['ap-aging', asOfDate ?? 'today', supplierCompanyId ?? 'all'],
		queryFn: () =>
			getData<TAgingResponse>(`/finance/ap/aging${query ? `?${query}` : ''}`),
	});
}

/* ----------------------- financial reports (F6) --------------------------- */

export type TReportLine = {
	accountId: string;
	code: string;
	name: string;
	accountType: string;
	amount: number;
};

export type TProfitAndLoss = {
	startDate: string;
	endDate: string;
	revenue: TReportLine[];
	expenses: TReportLine[];
	totalRevenue: number;
	totalExpenses: number;
	netIncome: number;
};

export type TBalanceSheet = {
	asOfDate: string;
	assets: TReportLine[];
	liabilities: TReportLine[];
	equity: TReportLine[];
	totalAssets: number;
	totalLiabilities: number;
	totalEquity: number;
	unexplained: number;
};

export type TCashFlowEntry = {
	accountId: string;
	code: string;
	name: string;
	cashFlowCategory: string;
	amount: number;
};

export type TCashFlowStatement = {
	startDate: string;
	endDate: string;
	operating: TCashFlowEntry[];
	investing: TCashFlowEntry[];
	financing: TCashFlowEntry[];
	netOperating: number;
	netInvesting: number;
	netFinancing: number;
	netChangeInCash: number;
};

export function profitAndLossQueryOptions(startDate: string, endDate: string) {
	return queryOptions({
		queryKey: ['pl', startDate, endDate],
		queryFn: () =>
			getData<TProfitAndLoss>(
				`/finance/reports/profit-and-loss?startDate=${startDate}&endDate=${endDate}`,
			),
	});
}

export function balanceSheetQueryOptions(asOfDate: string) {
	return queryOptions({
		queryKey: ['balance-sheet', asOfDate],
		queryFn: () =>
			getData<TBalanceSheet>(`/finance/reports/balance-sheet?asOfDate=${asOfDate}`),
	});
}

export function cashFlowQueryOptions(startDate: string, endDate: string) {
	return queryOptions({
		queryKey: ['cash-flow', startDate, endDate],
		queryFn: () =>
			getData<TCashFlowStatement>(
				`/finance/reports/cash-flow?startDate=${startDate}&endDate=${endDate}`,
			),
	});
}

/* --------------------- monthly report archive (M12 T30) -------------------- */

export const REPORT_ARCHIVE_TYPES = [
	'profit_and_loss',
	'balance_sheet',
	'cash_flow',
] as const;
export type TReportArchiveType = (typeof REPORT_ARCHIVE_TYPES)[number];

export type TReportArchive = {
	id: string;
	organizationId: string | null;
	periodYear: number;
	periodMonth: number;
	reportType: TReportArchiveType;
	payload: TProfitAndLoss | TBalanceSheet | TCashFlowStatement;
	generatedBy: string | null;
	generatedAt: string;
};

export function reportArchivesQueryOptions(params: {
	page: number;
	limit: number;
	periodYear?: number;
}) {
	const search = new URLSearchParams({
		page: String(params.page),
		limit: String(params.limit),
	});
	if (params.periodYear != null) {
		search.set('periodYear', String(params.periodYear));
	}
	return queryOptions({
		queryKey: ['report-archives', params],
		queryFn: () =>
			getDataPaginated<TReportArchive>(`/finance/reports/archives?${search}`),
	});
}

export function reportArchiveQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['report-archive', id],
		queryFn: () => getData<TReportArchive>(`/finance/reports/archives/${id}`),
	});
}

export function archiveMonth(periodYear: number, periodMonth: number) {
	return sendData<TReportArchive[]>('/finance/reports/archives', 'POST', {
		periodYear,
		periodMonth,
	});
}

/* ------------------------- month-end close (F7) --------------------------- */
export type TCloseChecklistItem = {
	key: string;
	label: string;
	pass: boolean;
	count: number;
};

export type TCloseChecklist = {
	periodYear: number;
	periodMonth: number;
	startDate: string;
	endDate: string;
	allClear: boolean;
	items: TCloseChecklistItem[];
};

export function closeChecklistQueryOptions(year: number, month: number) {
	return queryOptions({
		queryKey: ['close-checklist', year, month],
		queryFn: () =>
			getData<TCloseChecklist>(`/finance/close/checklist?periodYear=${year}&periodMonth=${month}`),
	});
}

/* -------------------- bank reconciliation (F6) ---------------------------- */

export type TBankReconciliationItem = {
	id: string;
	bankReconciliationId: string;
	cashBankTransactionId: string | null;
	statementReference: string | null;
	statementAmount: number | null;
	isMatched: boolean;
	notes: string | null;
};

export type TBankReconciliation = {
	id: string;
	code: string;
	cashBankAccountId: string;
	reconciliationDate: string;
	statementBalance: number;
	bookBalance: number;
	difference: number;
	status: 'draft' | 'in_progress' | 'reconciled' | 'closed';
	notes: string | null;
};

export function reconciliationsQueryOptions(params: {
	page: number;
	limit: number;
	status?: string;
}) {
	const search = new URLSearchParams({
		page: String(params.page),
		limit: String(params.limit),
	});
	if (params.status) search.set('status', params.status);
	return queryOptions({
		queryKey: ['reconciliations', params],
		queryFn: () =>
			getDataPaginated<TBankReconciliation>(`/finance/reconciliations?${search}`),
	});
}

export function reconciliationQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['reconciliations', id],
		queryFn: () => getData<TBankReconciliation>(`/finance/reconciliations/${id}`),
	});
}

export function createReconciliation(input: {
	cashBankAccountId: string;
	reconciliationDate: string;
	statementBalance: number;
	notes?: string | null;
}) {
	return sendData<TBankReconciliation>('/finance/reconciliations', 'POST', input);
}

export function addReconciliationItems(
	id: string,
	items: Array<{
		cashBankTransactionId?: string | null;
		statementReference?: string | null;
		statementAmount?: number | null;
		notes?: string | null;
	}>,
) {
	return sendData<TBankReconciliationItem[]>(
		`/finance/reconciliations/${id}/items`,
		'POST',
		{ items },
	);
}

export function matchReconciliationItem(
	id: string,
	itemId: string,
	cashBankTransactionId: string | null,
) {
	return sendData<TBankReconciliationItem>(
		`/finance/bank-reconciliations/${id}/items/${itemId}/match`,
		'POST',
		{ cashBankTransactionId },
	);
}

/**
 * Matches a statement item. The backend mounts this one route at
 * `/finance/bank-reconciliations/:id/items/:productId/match` (the last segment
 * is the item id despite its name); the other reconciliation routes live under
 * `/finance/reconciliations`.
 */
export const reconcileReconciliation = (id: string) =>
	sendData<TBankReconciliation>(`/finance/reconciliations/${id}/reconcile`, 'POST');
export const closeReconciliation = (id: string) =>
	sendData<TBankReconciliation>(`/finance/reconciliations/${id}/close`, 'POST');

/* ------------------------- expense claims (ERP-0013) ------------------------- */

export const EXPENSE_CLAIM_STATUSES = [
	'draft',
	'submitted',
	'approved',
	'rejected',
	'paid',
	'cancelled',
] as const;
export type TExpenseClaimStatus = (typeof EXPENSE_CLAIM_STATUSES)[number];

export type TExpenseClaimItem = {
	id: string;
	organizationId: string | null;
	expenseClaimId: string;
	expenseDate: string | null;
	categoryCode: string | null;
	description: string | null;
	amount: number;
	taxAmount: number;
	currencyCode: string;
	receiptDocumentId: string | null;
};

export type TExpenseClaim = {
	id: string;
	organizationId: string | null;
	code: string;
	employeeId: string | null;
	claimDate: string | null;
	totalAmount: number;
	currencyCode: string;
	status: TExpenseClaimStatus;
	submittedBy: string | null;
	submittedAt: string | number | null;
	approvedBy: string | null;
	approvedAt: string | number | null;
	paymentId: string | null;
	notes: string | null;
};

export type TExpenseClaimDetail = TExpenseClaim & {
	items: TExpenseClaimItem[];
	journalEntry: { id: string; code: string; entryDate: string | null } | null;
};

export type TExpenseClaimItemInput = {
	expenseDate?: string | null;
	categoryCode: string;
	description?: string | null;
	amount: number;
	taxAmount?: number;
};

export function expenseClaimsQueryOptions(params: {
	page: number;
	limit: number;
	status?: TExpenseClaimStatus;
	employeeId?: string;
	from?: string;
	to?: string;
	search?: string;
	sortBy?: 'code' | 'claimDate' | 'totalAmount' | 'createdAt';
	sortDir?: 'asc' | 'desc';
}) {
	const search = new URLSearchParams({
		page: String(params.page),
		limit: String(params.limit),
	});
	for (const key of ['status', 'employeeId', 'from', 'to', 'search', 'sortBy', 'sortDir'] as const) {
		const value = params[key];
		if (value !== undefined && value !== '') search.set(key, String(value));
	}
	return queryOptions({
		queryKey: ['expense-claims', params],
		queryFn: () => getDataPaginated<TExpenseClaim>(`/finance/expenses?${search}`),
	});
}

export function expenseClaimQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['expense-claims', 'detail', id],
		queryFn: () => getData<TExpenseClaimDetail>(`/finance/expenses/${id}`),
	});
}

export function createExpenseClaim(input: {
	employeeId: string;
	claimDate: string;
	notes?: string | null;
	items: TExpenseClaimItemInput[];
}) {
	return sendData<TExpenseClaimDetail>('/finance/expenses', 'POST', input);
}

export function updateExpenseClaim(
	id: string,
	input: {
		employeeId?: string;
		claimDate?: string;
		notes?: string | null;
		items?: TExpenseClaimItemInput[];
	},
) {
	return sendData<TExpenseClaimDetail>(`/finance/expenses/${id}`, 'PATCH', input);
}

export const submitExpenseClaim = (id: string) =>
	sendData<TExpenseClaim>(`/finance/expenses/${id}/submit`, 'POST');
export const approveExpenseClaim = (id: string) =>
	sendData<TExpenseClaim>(`/finance/expenses/${id}/approve`, 'POST');
export const rejectExpenseClaim = (id: string) =>
	sendData<TExpenseClaim>(`/finance/expenses/${id}/reject`, 'POST');
export const cancelExpenseClaim = (id: string) =>
	sendData<TExpenseClaim>(`/finance/expenses/${id}/cancel`, 'POST');

/* ----------------------------- receivable adjustments (ERP-0135) ----------------------------- */

export type TCreditMemoStatus = 'draft' | 'issued' | 'applied' | 'void';

export type TCreditMemo = {
	id: string;
	code: string;
	invoiceId: string | null;
	customerId: string | null;
	memoDate: string | null;
	amount: number;
	taxAmount: number;
	reason: string | null;
	status: TCreditMemoStatus;
	journalEntryId: string | null;
};

export function creditMemosQueryOptions(params: { page: number; limit: number; invoiceId?: string; status?: TCreditMemoStatus }) {
	const search = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
	if (params.invoiceId) search.set('invoiceId', params.invoiceId);
	if (params.status) search.set('status', params.status);
	return queryOptions({
		queryKey: ['credit-memos', params],
		queryFn: () => getDataPaginated<TCreditMemo>(`/finance/credit-memos?${search}`),
	});
}

export function createCreditMemo(input: { invoiceId: string; memoDate: string; amount: number; reason: string }) {
	return sendData<TCreditMemo>('/finance/credit-memos', 'POST', input);
}

export function applyCreditMemo(id: string) {
	return sendData<TCreditMemo>(`/finance/credit-memos/${id}/apply`, 'POST');
}

export function voidCreditMemo(id: string, reason: string) {
	return sendData<TCreditMemo>(`/finance/credit-memos/${id}/void`, 'POST', { reason });
}

/** An AR open item carrying a pending write-off request. */
export type TWriteOffRequest = {
	id: string;
	invoiceId: string | null;
	customerId: string | null;
	outstandingAmount: number;
	writeOffReason: string | null;
	writeOffRequestedBy: string | null;
	writeOffRequestedAt: string | null;
};

export function writeOffRequestsQueryOptions() {
	return queryOptions({
		queryKey: ['write-offs'],
		queryFn: () => getData<TWriteOffRequest[]>('/finance/ar/write-offs'),
	});
}

export function requestWriteOff(invoiceId: string, reason: string) {
	return sendData<TWriteOffRequest>(`/finance/ar/${invoiceId}/write-off/request`, 'POST', { reason });
}

export function cancelWriteOff(invoiceId: string) {
	return sendData<TWriteOffRequest>(`/finance/ar/${invoiceId}/write-off/cancel`, 'POST');
}

export function approveWriteOff(invoiceId: string) {
	return sendData<TWriteOffRequest>(`/finance/ar/${invoiceId}/write-off/approve`, 'POST');
}

/* ----------------------------- deferred revenue (ERP-0135) ----------------------------- */

export type TAmortisationRun = { month: string; schedules: number; entries: number; amount: number };

export function runDeferredRevenue(year: number, month: number) {
	return sendData<TAmortisationRun>('/finance/deferred-revenue/run', 'POST', { year, month });
}

/* ----------------------------- gateway settlement (ERP-0139) ----------------------------- */

export function recordGatewaySettlement(input: {
	cashBankAccountId: string;
	settlementDate: string;
	grossAmount: number;
	feeAmount: number;
	reference: string;
}) {
	return sendData<{ net: number; fee: number }>('/finance/gateway-settlements', 'POST', input);
}

/* ----------------------------- tax postings (ERP-0140) ----------------------------- */

export const TAX_PAYMENT_ROLES = ['vat_payable', 'wht_payable', 'pph21_payable', 'pph25_payable'] as const;
export type TTaxPaymentRole = (typeof TAX_PAYMENT_ROLES)[number];

export type TPpnSettlement = { period: string; output: number; input: number; net: number; journalEntryId: string | null };

export function settlePpn(year: number, month: number) {
	return sendData<TPpnSettlement>('/finance/tax/ppn-settlements', 'POST', { year, month });
}

export function payTax(input: {
	role: TTaxPaymentRole;
	taxCode: string | null;
	cashBankAccountId: string;
	paymentDate: string;
	amount: number;
	reference: string;
}) {
	return sendData<{ id: string }>('/finance/tax/payments', 'POST', input);
}

/* ----------------------------- payroll payments (ERP-0138) ----------------------------- */

export const PAYROLL_PAYMENT_ROLES = ['salary_payable', 'bpjs_payable'] as const;
export type TPayrollPaymentRole = (typeof PAYROLL_PAYMENT_ROLES)[number];

export function payPayroll(input: {
	role: TPayrollPaymentRole;
	cashBankAccountId: string;
	paymentDate: string;
	amount: number;
	reference: string;
}) {
	return sendData<{ id: string }>('/finance/payroll/payments', 'POST', input);
}

/* ----------------------------- opening sub-ledgers (ERP-0142) ----------------------------- */

export type TSubledger = 'ar' | 'ap';

export type TSubledgerTie = {
	ledger: TSubledger;
	items: number;
	total: number;
	controlAccountId: string | null;
	control: number;
	tied: boolean;
	posted: number;
};

export type TOpeningSubledgerItem = {
	id: string;
	ledger: TSubledger;
	partyCode: string;
	partyName: string;
	documentNumber: string;
	documentDate: string;
	dueDate: string | null;
	amount: number;
	asOfDate: string;
	postedAt: string | null;
};

export type TOpeningSubledgerImportResult = {
	imported: number;
	total: number;
	errors: { row: number; code: string; value: string }[];
};

export function openingSubledgerQueryOptions() {
	return queryOptions({
		queryKey: ['opening-balances', 'subledger'],
		queryFn: () => getData<{ ledgers: TSubledgerTie[]; items: TOpeningSubledgerItem[] }>('/finance/ledger/opening-balances/subledger'),
	});
}

/** Uploads the open AR invoices or AP bills at cutover (CSV, all or nothing). */
export async function importOpeningSubledger(ledger: TSubledger, asOfDate: string, file: File): Promise<TOpeningSubledgerImportResult> {
	const form = new FormData();
	form.append('file', file);
	const response = await fetch(`${API_URL}/finance/ledger/opening-balances/subledger/import?ledger=${ledger}&asOfDate=${asOfDate}`, {
		method: 'POST',
		credentials: 'include',
		headers: { ...organizationHeaders() },
		body: form,
	});
	const envelope = (await response.json()) as TApiResponse<TOpeningSubledgerImportResult>;
	if (!response.ok) throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed');
	return envelope.data as TOpeningSubledgerImportResult;
}

export function discardOpeningSubledger(ledger: TSubledger) {
	return sendData<{ removed: number }>(`/finance/ledger/opening-balances/subledger/discard?ledger=${ledger}`, 'POST');
}
