import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from 'i18next';
import { renderToString } from 'react-dom/server';
import { initReactI18next } from 'react-i18next';
import { en } from '@ims-erp/locales/en';
import * as usePermissionModule from '@/lib/use-permission';
import * as confirmDialogModule from '@/components/confirm-dialog';
import { billsQueryOptions } from '@/lib/finance-api';

mock.module('@/lib/use-permission', () => ({
	...usePermissionModule,
	usePermission: () => true,
}));

mock.module('@/components/confirm-dialog', () => ({
	...confirmDialogModule,
	useConfirm: () => async () => true,
}));

const { BillsTable } = await import('@/components/finance/bills-table');

beforeAll(async () => {
	await i18n.use(initReactI18next).init({
		lng: 'en',
		fallbackLng: 'en',
		resources: { en },
		defaultNS: 'common',
		keySeparator: false,
		interpolation: { escapeValue: false },
	});
});

afterAll(() => {
	mock.module('@/lib/use-permission', () => usePermissionModule);
	mock.module('@/components/confirm-dialog', () => confirmDialogModule);
});

describe('BillsTable', () => {
	test('keeps both bill-creation actions visible when the list is empty', () => {
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		client.setQueryData(billsQueryOptions({ page: 1, limit: 20 }).queryKey, {
			rows: [],
			pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
		});

		const html = renderToString(
			<QueryClientProvider client={client}>
				<BillsTable />
			</QueryClientProvider>,
		);

		expect(html).toContain('No supplier bills yet.');
		expect(html).toContain('Bill from a purchase order');
		expect(html).toContain('New bill');
	});
});
