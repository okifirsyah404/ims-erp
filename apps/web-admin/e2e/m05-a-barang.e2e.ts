import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, type Page, test } from '@playwright/test';

import { RUN_ID } from './support/accounts';
import { apiData, pageAs, toast } from './support/session';

/**
 * UAT M05 bagian A (docs/adjustment/uat-modul/m05-inventaris-pembelian.md):
 * kategori, komponen, material, produk, SKU ganda. Logged in as the owner
 * (`admin`), the only account that can open the product pages today.
 */
test.describe.configure({ mode: 'serial' });

const slug = `uat-kabel-${RUN_ID.toLowerCase()}`;
const categoryName = `Kabel UAT ${RUN_ID}`;
const componentSku = `UAT-CMP-${RUN_ID}`;
const materialSku = `UAT-MAT-${RUN_ID}`;
const productSku = `UAT-KBL-${RUN_ID}`;

const fixtures = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures');

let page: Page;

test.beforeAll(async ({ browser }) => {
	page = await pageAs(browser, 'admin');
});

test.afterAll(async () => {
	await page.context().close();
});

test('A1 kategori: tersimpan, slug ganda ditolak', async () => {
	await page.goto('/product-categories');
	await page.getByRole('button', { name: 'Kategori baru' }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();

	await dialog.getByLabel('Slug URL').fill(slug);
	await dialog.getByLabel('Nama', { exact: true }).fill(categoryName);
	await dialog.getByLabel('Urutan').fill('5');
	await dialog.getByLabel('Nama pendek').fill('Kabel');
	await dialog.getByLabel('Deskripsi').fill('Kategori kabel untuk UAT otomatis');
	await dialog.getByRole('button', { name: 'Simpan' }).click();

	await expect(toast(page, 'Kategori disimpan')).toBeVisible();
	const categories = await apiData<{ slug: string; name: string }[]>(page, '/product-categories');
	expect(categories.find((category) => category.slug === slug)?.name).toBe(categoryName);

	// Same slug again → refused.
	await page.getByRole('button', { name: 'Kategori baru' }).click();
	await dialog.getByLabel('Slug URL').fill(slug);
	await dialog.getByLabel('Nama', { exact: true }).fill(`${categoryName} dobel`);
	await dialog.getByRole('button', { name: 'Simpan' }).click();
	await expect(page.getByText('Kategori barang dengan slug ini sudah ada')).toBeVisible();
	await dialog.getByRole('button', { name: 'Batal' }).click();
});

/** Opens "Barang baru" on a kind page and fills the identity fields. */
async function openNewItem(url: string, name: string, sku: string) {
	await page.goto(url);
	await page.getByRole('button', { name: 'Barang baru' }).first().click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();
	await dialog.getByLabel('Nama', { exact: true }).fill(name);
	await dialog.getByLabel('Kode SKU').fill(sku);
	return dialog;
}

/** Confirms the product exists through the API (independent of list paging). */
async function expectProduct(sku: string) {
	const rows = await apiData<{ sku: string }[]>(page, `/products?search=${encodeURIComponent(sku)}`);
	expect(rows.map((row) => row.sku)).toContain(sku);
}

test('A2 komponen tersimpan dengan kode CMP-', async () => {
	const dialog = await openNewItem('/inventory/components', `Modul relay UAT ${RUN_ID}`, componentSku);
	await dialog.getByRole('button', { name: 'Buat barang' }).click();
	await expect(toast(page, 'Barang dibuat')).toBeVisible();
	await expect(page.getByText(/Unexpected token/)).toHaveCount(0);
	await expectProduct(componentSku);
});

test('A3 material tersimpan dengan kode MAT-', async () => {
	const dialog = await openNewItem('/inventory/materials', `Konektor RJ45 UAT ${RUN_ID}`, materialSku);
	await dialog.getByRole('button', { name: 'Buat barang' }).click();
	await expect(toast(page, 'Barang dibuat')).toBeVisible();
	await expect(page.getByText(/Unexpected token/)).toHaveCount(0);
	await expectProduct(materialSku);
});

test('A4 produk: tombol nonaktif tanpa nama/SKU, lalu tersimpan', async () => {
	await page.goto('/products');
	await page.getByRole('button', { name: 'Barang baru' }).first().click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByRole('button', { name: 'Buat barang' })).toBeDisabled();

	await dialog.getByLabel('Nama', { exact: true }).fill(`Kabel UTP Cat6 UAT ${RUN_ID}`);
	await dialog.getByLabel('Kode SKU').fill(productSku);
	await dialog.getByLabel('Merek').fill('Belden');
	// Two photos, uploaded after the product is saved (finding M05 A4).
	await dialog.locator('input[type=file]').setInputFiles([
		resolve(fixtures, 'foto-1.png'),
		resolve(fixtures, 'foto-2.png'),
	]);
	await dialog.getByRole('button', { name: 'Buat barang' }).click();
	await expect(toast(page, 'Barang dibuat')).toBeVisible();
	await expect(page.getByText(/Unexpected token|an unexpected error/)).toHaveCount(0);
});

test('A5 detail produk menampilkan 2 foto', async () => {
	const [product] = await apiData<{ id: string; sku: string }[]>(page, `/products?search=${encodeURIComponent(productSku)}`);
	await page.goto(`/products/${product?.id}`);
	await page.getByText('Foto di dokumen').scrollIntoViewIfNeeded();
	await expect(page.getByText('(2/10)')).toBeVisible();
	const photos = page.locator('img[src*="/inventory/products/"]');
	await expect(photos).toHaveCount(2, { timeout: 15_000 });
	// Loaded, not just present: a broken (403) image has naturalWidth 0.
	await expect
		.poll(() => photos.evaluateAll((images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0)))
		.toBe(true);
});

test('A8 SKU ganda ditolak', async () => {
	const dialog = await openNewItem('/products', 'Kabel duplikat', productSku);
	await dialog.getByRole('button', { name: 'Buat barang' }).click();
	await expect(page.getByText('Barang dengan SKU ini sudah ada')).toBeVisible();
	await dialog.getByRole('button', { name: 'Batal' }).click();
});
