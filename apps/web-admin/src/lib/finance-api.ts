import type {
	TApiPaginatedResponse,
	TApiResponse,
	TPaginationMeta,
} from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';

/**
 * API client for the M09 accounting endpoints (`/accounts`, `/periods`,
 * `/journal`, `/opening-balances`, `/cash-bank/*`, `/payments*`, `/bills*`,
 * `/ar|ap/aging`, `/reports/*`, `/close/*`, `/bank-reconciliations*`).
 *
 * @remarks
 * Tenant scope is decided by the backend from the caller's active
 * organization. `chart_of_account:*`, `journal:*`, `accounting_period:*`,
 * `cash_bank:*`, `payment:*`, `bill:*` and `financial_report:*` permissions
 * gate every call server-side; the UI only hides controls it knows will
 * fail. Money fields are exact integer minor units (rupiah x 100).
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type TPaginated<T> = { rows: T[]; pagination: TPaginationMeta };

async function request<T>(
	path: string,
	init?: RequestInit,
): Promise<TApiResponse<T>> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers:
			init?.body != null ? { 'Content-Type': 'application/json' } : undefined,
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
	organizationId: string;
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
}) {
	const search = new URLSearchParams({
		page: String(params.page),
		limit: String(params.limit),
	});
	if (params.accountType) search.set('accountType', params.accountType);
	if (params.isActive !== undefined)
		search.set('isActive', String(params.isActive));
	return queryOptions({
		queryKey: ['accounts', params],
		queryFn: () => getDataPaginated<TAccount>(`/accounts?${search}`),
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
	return sendData<TAccount>('/accounts', 'POST', input);
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
	return sendData<TAccount>(`/accounts/${id}`, 'PATCH', input);
}

export function archiveAccount(id: string) {
	return sendData<{ removed: boolean }>(`/accounts/${id}`, 'DELETE');
}

/* --------------------------- accounting periods --------------------------- */

export type TPeriod = {
	id: string;
	organizationId: string;
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
			getDataPaginated<TPeriod>(`/periods?page=${params.page}&limit=${params.limit}`),
	});
}

export function ensurePeriod(periodYear: number, periodMonth: number) {
	return sendData<TPeriod>('/periods', 'POST', { periodYear, periodMonth });
}

export function transitionPeriod(id: string, to: 'closed' | 'locked' | 'open') {
	return sendData<TPeriod>(`/periods/${id}/transition`, 'POST', { to });
}

/* ----------------------------- journal (F2) ------------------------------- */

export type TJournalLine = {
	id: string;
	journalEntryId: string;
	accountId: string;
	debit: number;
	credit: number;
	description: string | null;
};

export type TJournalEntry = {
	id: string;
	organizationId: string;
	code: string;
	entryDate: string;
	sourceType: string;
	sourceId: string | null;
	description: string | null;
	status: string;
	reversalOfEntryId: string | null;
	reversedByEntryId: string | null;
	idempotencyKey: string | null;
	lines?: TJournalLine[];
};

export function journalQueryOptions(params: {
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
		queryKey: ['journal', params],
		queryFn: () => getDataPaginated<TJournalEntry>(`/journal?${search}`),
	});
}

export function journalEntryQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['journal', id],
		queryFn: () => getData<TJournalEntry>(`/journal/${id}`),
	});
}

export function postJournalEntry(input: {
	entryDate: string;
	description?: string | null;
	lines: Array<{
		accountId: string;
		debit: number;
		credit: number;
		description?: string | null;
	}>;
}) {
	return sendData<TJournalEntry>('/journal', 'POST', input);
}

export function reverseJournalEntry(
	id: string,
	input?: { entryDate?: string; description?: string | null },
) {
	return sendData<TJournalEntry>(`/journal/${id}/reverse`, 'POST', input);
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
		queryFn: () => getData<TOpeningBalanceRow[]>('/opening-balances'),
	});
}

export function addOpeningBalanceRow(input: {
	accountId: string;
	asOfDate: string;
	debitBalance: number;
	creditBalance: number;
	description?: string | null;
}) {
	return sendData<TOpeningBalanceRow>('/opening-balances', 'POST', input);
}

export function updateOpeningBalanceRow(
	id: string,
	input: Partial<{
		debitBalance: number;
		creditBalance: number;
		description: string | null;
	}>,
) {
	return sendData<TOpeningBalanceRow>(`/opening-balances/${id}`, 'PATCH', input);
}

export function removeOpeningBalanceRow(id: string) {
	return sendData<{ removed: boolean }>(`/opening-balances/${id}`, 'DELETE');
}

export function postOpeningBalances() {
	return sendData<{ entryId: string }>('/opening-balances/post', 'POST');
}

/* --------------------------- cash & bank (F3) ----------------------------- */

export type TCashBankAccount = {
	id: string;
	organizationId: string;
	code: string;
	name: string;
	accountType: string;
	bankName: string | null;
	accountNumber: string | null;
	accountHolder: string | null;
	openingBalance: number;
	currentBalance: number;
	currencyCode: string;
	isActive: boolean;
	glAccountId?: string | null;
};

export type TCashBankTransaction = {
	id: string;
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
		queryFn: () => getData<TCashBankAccount[]>('/cash-bank/accounts'),
	});
}

export function createCashBankAccount(input: {
	code: string;
	name: string;
	accountType: string;
	bankName?: string | null;
	accountNumber?: string | null;
	accountHolder?: string | null;
	openingBalance?: number;
	glAccountId?: string | null;
}) {
	return sendData<TCashBankAccount>('/cash-bank/accounts', 'POST', input);
}

export function updateCashBankAccount(
	id: string,
	input: Partial<{
		name: string;
		bankName: string | null;
		accountNumber: string | null;
		accountHolder: string | null;
		isActive: boolean;
		glAccountId: string | null;
	}>,
) {
	return sendData<TCashBankAccount>(`/cash-bank/accounts/${id}`, 'PATCH', input);
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
			getDataPaginated<TCashBankTransaction>(`/cash-bank/transactions?${search}`),
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
	return sendData<TCashBankTransaction>('/cash-bank/transactions', 'POST', input);
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
	supplierId: string | null;
	purchaseOrderId: string | null;
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

export function billsQueryOptions(params: {
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
		queryKey: ['bills', params],
		queryFn: () => getDataPaginated<TSupplierBill>(`/bills?${search}`),
	});
}

export function createBill(input: {
	supplierId: string;
	billDate: string;
	dueDate?: string | null;
	subtotal: number;
	taxTotal: number;
	notes?: string | null;
}) {
	return sendData<TSupplierBill>('/bills', 'POST', input);
}

export const cancelBill = (id: string) =>
	sendData<TSupplierBill>(`/bills/${id}/cancel`, 'POST');
export const recordBill = (id: string) =>
	sendData<TSupplierBill>(`/bills/${id}/record`, 'POST');

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
		supplierId?: string | null;
		buckets: Record<TAgingBucket, number>;
		total: number;
	}>;
	grandTotal: number;
};

export function arAgingQueryOptions(asOfDate?: string) {
	return queryOptions({
		queryKey: ['ar-aging', asOfDate ?? 'today'],
		queryFn: () =>
			getData<TAgingResponse>(
				asOfDate ? `/ar/aging?asOfDate=${asOfDate}` : '/ar/aging',
			),
	});
}

export function apAgingQueryOptions(asOfDate?: string) {
	return queryOptions({
		queryKey: ['ap-aging', asOfDate ?? 'today'],
		queryFn: () =>
			getData<TAgingResponse>(
				asOfDate ? `/ap/aging?asOfDate=${asOfDate}` : '/ap/aging',
			),
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
				`/reports/profit-and-loss?startDate=${startDate}&endDate=${endDate}`,
			),
	});
}

export function balanceSheetQueryOptions(asOfDate: string) {
	return queryOptions({
		queryKey: ['balance-sheet', asOfDate],
		queryFn: () =>
			getData<TBalanceSheet>(`/reports/balance-sheet?asOfDate=${asOfDate}`),
	});
}

export function cashFlowQueryOptions(startDate: string, endDate: string) {
	return queryOptions({
		queryKey: ['cash-flow', startDate, endDate],
		queryFn: () =>
			getData<TCashFlowStatement>(
				`/reports/cash-flow?startDate=${startDate}&endDate=${endDate}`,
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
	organizationId: string;
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
			getDataPaginated<TReportArchive>(`/reports/archives?${search}`),
	});
}

export function reportArchiveQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['report-archive', id],
		queryFn: () => getData<TReportArchive>(`/reports/archives/${id}`),
	});
}

export function archiveMonth(periodYear: number, periodMonth: number) {
	return sendData<TReportArchive[]>('/reports/archives', 'POST', {
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
			getData<TCloseChecklist>(`/close/checklist?periodYear=${year}&periodMonth=${month}`),
	});
}

/* -------------------- bank reconciliation (F6) ---------------------------- */

export type TBankReconciliationItem = {
	id: string;
	bankReconciliationId: string;
	cashBankTransactionId: string | null;
	statementReference: string | null;
	statementAmount: number | null;
	matchedAt: string | null;
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
			getDataPaginated<TBankReconciliation>(`/bank-reconciliations?${search}`),
	});
}

export function reconciliationQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['reconciliations', id],
		queryFn: () => getData<TBankReconciliation>(`/bank-reconciliations/${id}`),
	});
}

export function reconciliationItemsQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['reconciliations', id, 'items'],
		queryFn: () =>
			getData<TBankReconciliationItem[]>(`/bank-reconciliations/${id}/items`),
	});
}

export function createReconciliation(input: {
	cashBankAccountId: string;
	reconciliationDate: string;
	statementBalance: number;
	notes?: string | null;
}) {
	return sendData<TBankReconciliation>('/bank-reconciliations', 'POST', input);
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
		`/bank-reconciliations/${id}/items`,
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
		`/bank-reconciliations/${id}/items/${itemId}/match`,
		'POST',
		{ cashBankTransactionId },
	);
}

export const reconcileReconciliation = (id: string) =>
	sendData<TBankReconciliation>(`/bank-reconciliations/${id}/reconcile`, 'POST');
export const closeReconciliation = (id: string) =>
	sendData<TBankReconciliation>(`/bank-reconciliations/${id}/close`, 'POST');
