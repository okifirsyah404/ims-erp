import type { TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';
import { organizationHeaders } from '@/lib/organization-store';

/**
 * The caller's own payslips (`/users/me/payslips`, ERP-0122).
 *
 * @remarks
 * Those two routes are **session-only** (no organization header needed, and no
 * `employeeId`): the backend resolves the employee from the session, so the
 * portal reuses them unchanged. The print view is a public render-token page,
 * exactly like web-admin's `/print/payslips/:id`.
 */
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** One payslip in the self-service list. */
export type TMyPayslip = {
	recordId: string;
	period: string;
	netPay: number;
	/** False until the PDF exists (still rendering, or the render failed). */
	ready: boolean;
};

async function parse<T>(response: Response): Promise<TApiResponse<T>> {
	const text = await response.text();
	const envelope = (text ? JSON.parse(text) : {}) as TApiResponse<T>;
	if (!response.ok) {
		throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? `Request failed (${response.status})`);
	}
	return envelope;
}

async function getData<T>(path: string): Promise<T> {
	const envelope = await parse<T>(
		await fetch(`${API_URL}${path}`, {
			credentials: 'include',
			headers: { 'Accept-Language': currentLanguage(), ...organizationHeaders() },
		}),
	);
	if (envelope.data === null) throw new Error(envelope.message ?? 'No data');
	return envelope.data;
}

export const myPayslipsQueryOptions = queryOptions({
	queryKey: ['employee-portal', 'payslips'] as const,
	queryFn: () => getData<TMyPayslip[]>('/users/me/payslips'),
});

/** A short-lived download URL of one of the caller's own payslips. */
export const downloadMyPayslip = (recordId: string) =>
	getData<{ url: string; fileName: string; mimeType: string | null }>(
		`/users/me/payslips/${recordId}/download`,
	);
