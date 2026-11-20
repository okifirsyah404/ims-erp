import type { TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/** A customer's addresses, read-only for staff (`GET /customers/:id/addresses`, ERP-0075). */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const ADDRESS_KINDS = ['billing', 'shipping', 'service', 'site', 'other'] as const;

export type TCustomerAddress = {
	id: string;
	kind: (typeof ADDRESS_KINDS)[number];
	label: string | null;
	contactName: string | null;
	contactPhone: string | null;
	addressLine: string | null;
	isPrimary: boolean;
};

export const customerAddressesQueryOptions = (customerId: string) =>
	queryOptions({
		queryKey: ['crm', 'customer-addresses', customerId] as const,
		queryFn: async () => {
			const response = await fetch(`${API_URL}/customers/${encodeURIComponent(customerId)}/addresses`, {
				credentials: 'include',
				headers: { 'Accept-Language': currentLanguage() },
			});
			const envelope = (await response.json()) as TApiResponse<TCustomerAddress[]>;
			if (!response.ok) throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed');
			return envelope.data ?? [];
		},
	});
