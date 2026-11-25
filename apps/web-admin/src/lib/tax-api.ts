import type {
	TApiPaginatedResponse,
	TApiResponse,
	TPaginationMeta,
} from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { organizationHeaders } from './organization-store';

/**
 * API client for the tax module (`/taxes*`, ERP-0016; split out of accounting by ADR-0024).
 *
 * @remarks
 * Tenant scope comes from the caller's active organization server-side.
 * `tax:*` permissions gate every call; the UI only hides controls it knows
 * will fail. Money fields are integer minor units (rupiah × 100).
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type TPaginated<T> = { rows: T[]; pagination: TPaginationMeta };

async function request<T>(path: string, init?: RequestInit): Promise<TApiResponse<T>> {
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

/* ------------------------------ tax types ------------------------------ */

export type TTaxType = {
	id: string;
	organizationId: string | null;
	code: string;
	name: string;
	taxType: string;
	rate: string;
	baseType: string;
	isInclusive: boolean;
	effectiveFrom: string;
	effectiveTo: string | null;
	isActive: boolean;
};

export type TTaxTypeListParams = { page: number; limit: number };

export function taxTypesQueryOptions(params: TTaxTypeListParams) {
	const search = new URLSearchParams({
		page: String(params.page),
		limit: String(params.limit),
	});
	return queryOptions({
		queryKey: ['tax-types', params],
		queryFn: () => getDataPaginated<TTaxType>(`/taxes?${search.toString()}`),
	});
}

export function createTaxType(input: Record<string, unknown>) {
	return sendData<TTaxType>('/taxes', 'POST', input);
}

export function updateTaxType(id: string, input: Record<string, unknown>) {
	return sendData<TTaxType>(`/taxes/${id}`, 'PATCH', input);
}

export function deleteTaxType(id: string) {
	return sendData<{ removed: boolean }>(`/taxes/${id}`, 'DELETE');
}

/* ------------------------------- recap --------------------------------- */

export type TRecapLine = {
	taxRecordId: string;
	taxTypeId: string;
	code: string;
	taxableBase: number;
	taxAmount: number;
	correctionTotal: number;
	netPayable: number;
	filingStatus: string;
};

export type TRecap = { lines: TRecapLine[]; totalNetPayable: number };

export function recapQueryOptions(year: number, month: number) {
	return queryOptions({
		queryKey: ['tax-recap', year, month],
		queryFn: () => getData<TRecap>(`/taxes/recap?year=${year}&month=${month}`),
	});
}

/** Builds the CSV download URL (the browser streams it with the session cookie). */
export function recapCsvUrl(year: number, month: number): string {
	return `${API_URL}/taxes/export.csv?year=${year}&month=${month}`;
}

/** Builds the XLSX download URL (phase 3). */
export function recapXlsxUrl(year: number, month: number): string {
	return `${API_URL}/taxes/export.xlsx?year=${year}&month=${month}`;
}

/* ------------------------------ records -------------------------------- */

export type TTaxRecord = {
	id: string;
	organizationId: string | null;
	code: string;
	taxTypeId: string;
	periodYear: number;
	periodMonth: number;
	taxableBase: number;
	taxAmount: number;
	filingStatus: string;
	verifiedBy: string | null;
	filedOn: string | null;
	notes: string | null;
};

export type TTaxRecordListParams = {
	page: number;
	limit: number;
	year?: number;
	month?: number;
};

export function taxRecordsQueryOptions(params: TTaxRecordListParams) {
	const search = new URLSearchParams({
		page: String(params.page),
		limit: String(params.limit),
	});
	if (params.year) search.set('year', String(params.year));
	if (params.month) search.set('month', String(params.month));
	return queryOptions({
		queryKey: ['tax-records', params],
		queryFn: () =>
			getDataPaginated<TTaxRecord>(`/taxes/records?${search.toString()}`),
	});
}

export function createTaxRecord(input: Record<string, unknown>) {
	return sendData<TTaxRecord>('/taxes/records', 'POST', input);
}

export function updateTaxRecord(id: string, input: Record<string, unknown>) {
	return sendData<TTaxRecord>(`/taxes/records/${id}`, 'PATCH', input);
}

export function transitionTaxRecord(id: string, to: string, filedOn?: string | null) {
	return sendData<TTaxRecord>(`/taxes/records/${id}/transition`, 'POST', {
		to,
		filedOn: filedOn ?? null,
	});
}

export function previewTax(input: {
	taxTypeId: string;
	taxableBase: number;
	date: string;
}) {
	return sendData<{ taxAmount: number; rate: string; effectiveFrom: string }>(
		'/taxes/records/preview',
		'POST',
		input,
	);
}

/* ----------------------------- corrections ------------------------------ */

export type TTaxCorrection = {
	id: string;
	taxRecordId: string;
	amount: number;
	reason: string;
	evidenceDocumentId: string | null;
	createdBy: string | null;
	createdAt: string;
};

export function correctionsQueryOptions(recordId: string) {
	return queryOptions({
		queryKey: ['tax-corrections', recordId],
		queryFn: () =>
			getData<TTaxCorrection[]>(`/taxes/records/${recordId}/corrections`),
	});
}

export function addCorrection(
	recordId: string,
	input: { amount: number; reason: string; evidenceDocumentId?: string | null },
) {
	return sendData<TTaxCorrection>(
		`/taxes/records/${recordId}/corrections`,
		'POST',
		input,
	);
}

/* ----------------------------- withholding ----------------------------- */

export type TWithholdingRecord = {
	id: string;
	organizationId: string | null;
	code: string;
	taxTypeId: string;
	counterpartyType: string | null;
	counterpartyId: string | null;
	baseAmount: number;
	taxAmount: number;
	transactionDate: string | null;
	periodYear: number | null;
	periodMonth: number | null;
	status: string;
	taxObjectCode: string | null;
	withholdingSlipNumber: string | null;
	counterpartyTaxId: string | null;
	sourceModule: string | null;
	coretaxStatus: TCoretaxStatus;
};

export const CORETAX_STATUSES = ['not_exported', 'exported', 'uploaded'] as const;
export type TCoretaxStatus = (typeof CORETAX_STATUSES)[number];

/** Bukti-potong data and Coretax status (ERP-0140). */
export function updateWithholdingCoretax(
	id: string,
	input: { coretaxStatus?: TCoretaxStatus; withholdingSlipNumber?: string | null; counterpartyTaxId?: string | null; taxObjectCode?: string | null },
) {
	return sendData<TWithholdingRecord>(`/taxes/withholdings/${id}/coretax`, 'PATCH', input);
}

export function withholdingQueryOptions(params: { page: number; limit: number }) {
	const search = new URLSearchParams({
		page: String(params.page),
		limit: String(params.limit),
	});
	return queryOptions({
		queryKey: ['tax-withholding', params],
		queryFn: () =>
			getDataPaginated<TWithholdingRecord>(`/taxes/withholdings?${search.toString()}`),
	});
}

export function createWithholding(input: Record<string, unknown>) {
	return sendData<TWithholdingRecord>('/taxes/withholdings', 'POST', input);
}

export function updateWithholding(id: string, input: Record<string, unknown>) {
	return sendData<TWithholdingRecord>(`/taxes/withholdings/${id}`, 'PATCH', input);
}

export function transitionWithholding(id: string, to: string) {
	return sendData<TWithholdingRecord>(
		`/taxes/withholdings/${id}/transition`,
		'POST',
		{ to },
	);
}
