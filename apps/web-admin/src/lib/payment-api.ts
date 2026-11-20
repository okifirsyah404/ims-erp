import type { TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * API client for the payment gateway configuration (`/admin/payments/gateways`).
 *
 * @remarks
 * Needs `payment_gateway:read` to list and `payment_gateway:update` to change.
 * Secrets are write-only (ADR-0024 Q18): the API never returns them, only the
 * `hasSecret` / `hasWebhookToken` flags and the last four characters of the
 * API secret. A secret sent on update replaces (rotates) the stored one; an
 * omitted secret keeps it.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const GATEWAY_PROVIDERS = ['xendit', 'singapay', 'fake'] as const;
export type TGatewayProvider = (typeof GATEWAY_PROVIDERS)[number];

export const GATEWAY_MODES = ['sandbox', 'live'] as const;
export type TGatewayMode = (typeof GATEWAY_MODES)[number];

/** A gateway as the API shows it: no ciphertext, no plaintext. */
export type TGateway = {
	id: string;
	provider: TGatewayProvider;
	code: string;
	name: string;
	mode: TGatewayMode;
	isActive: boolean;
	isDefault: boolean;
	/** Whether an API secret is loaded. */
	hasSecret: boolean;
	/** Last four characters of the API secret, for recognition only. */
	secretLast4: string | null;
	hasWebhookToken: boolean;
	rotatedAt: string | null;
};

export type TGatewayCreateInput = {
	provider: TGatewayProvider;
	code: string;
	name: string;
	mode: TGatewayMode;
	isActive: boolean;
	/** Write-only. */
	secret?: string;
	/** Write-only. */
	webhookToken?: string;
};

export type TGatewayUpdateInput = {
	name?: string;
	mode?: TGatewayMode;
	isActive?: boolean;
	/** Write-only; sending it rotates the stored secret. */
	secret?: string;
	/** Write-only; sending it rotates the stored webhook token. */
	webhookToken?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers: {
			// Server error messages come back in the UI language.
			'Accept-Language': currentLanguage(),
			...(init?.body != null ? { 'Content-Type': 'application/json' } : {}),
		},
		...init,
	});
	const envelope = (await response.json()) as TApiResponse<T>;
	if (!response.ok) {
		throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed');
	}
	return envelope.data as T;
}

export function gatewaysQueryOptions() {
	return queryOptions({
		queryKey: ['payment-gateways'],
		queryFn: () => request<TGateway[]>('/admin/payments/gateways'),
	});
}

export function createGateway(input: TGatewayCreateInput) {
	return request<TGateway>('/admin/payments/gateways', {
		method: 'POST',
		body: JSON.stringify(input),
	});
}

export function updateGateway(id: string, input: TGatewayUpdateInput) {
	return request<TGateway>(`/admin/payments/gateways/${encodeURIComponent(id)}`, {
		method: 'PATCH',
		body: JSON.stringify(input),
	});
}

/** Makes this gateway the one that opens new checkouts. */
export function setDefaultGateway(id: string) {
	return request<TGateway>(`/admin/payments/gateways/${encodeURIComponent(id)}/default`, {
		method: 'POST',
	});
}
