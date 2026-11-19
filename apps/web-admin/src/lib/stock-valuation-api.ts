import type { TApiResponse, TPaginationMeta } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';
import { organizationHeaders } from './organization-store';

/**
 * API client for the inventory value view (`/stock/valuation`, ADR-0011
 * step 5b): balances at moving-average cost. Needs `stock:read` and
 * `product:read_cost`. Money is IDR minor units.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type TStockValuationRow = {
	productId: string;
	sku: string;
	name: string;
	unit: string;
	warehouseId: string;
	warehouseCode: string;
	warehouseName: string;
	binCode: string | null;
	quantityOnHand: string;
	averageCost: number;
	totalValue: number;
};

export type TStockValuationWarehouse = {
	warehouseId: string;
	code: string;
	name: string;
	balances: number;
	totalValue: number;
};

export type TStockValuation = {
	meta: TPaginationMeta;
	data: TStockValuationRow[];
	warehouses: TStockValuationWarehouse[];
	grandTotal: number;
};

export function stockValuationQueryOptions(params: { page?: number; limit?: number; warehouseId?: string; search?: string }) {
	return queryOptions({
		queryKey: ['stock', 'valuation', params] as const,
		queryFn: async () => {
			const search = new URLSearchParams();
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined && value !== '') search.set(key, String(value));
			}
			const response = await fetch(`${API_URL}/stock/valuation${search.size ? `?${search}` : ''}`, {
				credentials: 'include',
				headers: { ...organizationHeaders(), 'Accept-Language': currentLanguage() },
			});
			const envelope = (await response.json()) as TApiResponse<TStockValuation>;
			if (!response.ok) throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed');
			return envelope.data as TStockValuation;
		},
	});
}
