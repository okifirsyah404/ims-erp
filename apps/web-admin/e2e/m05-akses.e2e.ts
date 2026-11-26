import { expect, test } from '@playwright/test';

import { pageAs } from './support/session';

/**
 * UAT M05 hak akses: what each role sees (A11, F6, F7). These pin the current
 * behaviour, including findings that wait for an owner decision (A11).
 */

test('A11 ⚠️ Pembelian membuka Produk: halaman khusus admin aplikasi', async ({ browser }) => {
	const page = await pageAs(browser, 'purchasing_seed');
	await page.goto('/products');
	await expect(page.getByText('Pengelolaan inventaris hanya tersedia untuk administrator aplikasi.')).toBeVisible();
	await page.context().close();
});

test('F6 Admin organisasi tidak melihat tombol penyesuaian stok', async ({ browser }) => {
	const page = await pageAs(browser, 'admin_seed');
	await page.goto('/inventory/stock/adjustments');
	await expect(page.getByRole('heading').first()).toBeVisible();
	await expect(page.getByRole('button', { name: 'Penyesuaian baru' })).toHaveCount(0);
	await page.goto('/inventory/stock');
	await expect(page.getByRole('button', { name: 'Sesuaikan stok' })).toHaveCount(0);
	await page.context().close();
});

test('F7 menu Nilai Persediaan: tidak untuk Gudang, ada untuk Keuangan', async ({ browser }) => {
	const warehouse = await pageAs(browser, 'warehouse_seed');
	await warehouse.goto('/');
	await expect(warehouse.getByRole('link', { name: 'Gudang' }).first()).toBeVisible();
	await expect(warehouse.getByRole('link', { name: 'Nilai Persediaan' })).toHaveCount(0);
	await warehouse.context().close();

	const finance = await pageAs(browser, 'finance_seed');
	await finance.goto('/');
	await expect(finance.getByRole('link', { name: 'Nilai Persediaan' })).toBeVisible();
	await finance.context().close();
});
