import type { TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import type { TCompanyProfile } from './company-api';
import type { TWarranty } from './handover-api';
import type { TInvoiceDetail } from './invoice-api';

/**
 * Data for the public print views the backend's PDF renderer opens (ERP-0079): an invoice
 * and a warranty certificate, each behind a short-lived render token (no session).
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function render<T>(path: string): Promise<T> {
	const response = await fetch(`${API_URL}${path}`, { headers: { 'Accept-Language': 'id' } });
	const envelope = (await response.json()) as TApiResponse<T>;
	if (!response.ok || !envelope.data) throw new Error(envelope.message ?? 'Not found');
	return envelope.data;
}

export const invoiceRenderQueryOptions = (id: string, org: string, token: string) =>
	queryOptions({
		queryKey: ['print', 'invoice', id] as const,
		queryFn: () =>
			render<{ invoice: TInvoiceDetail; profile: TCompanyProfile | null }>(
				`/public/v1/render/invoices/${encodeURIComponent(id)}?org=${encodeURIComponent(org)}&token=${encodeURIComponent(token)}`,
			),
		retry: false,
	});

export const warrantyRenderQueryOptions = (id: string, token: string) =>
	queryOptions({
		queryKey: ['print', 'warranty', id] as const,
		queryFn: () =>
			render<{ warranty: TWarranty; profile: TCompanyProfile | null }>(
				`/public/v1/render/warranties/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`,
			),
		retry: false,
	});
