import { expect, type Locator, type Page, test } from '@playwright/test';

import type { TRole } from './support/accounts';
import { inventoryFields, inventoryTable } from './support/form-inventory';
import { pageAs } from './support/session';
import {
	checkAccessibility,
	checkFieldRules,
	checkNoOverflow,
	checkToastOnTop,
	type TFieldRule,
} from './support/ui-checks';

/**
 * UI validation of the M05 forms (not their business behaviour, which the
 * other m05 specs cover): field rules, layout on a phone, toast position,
 * accessibility, and screenshots for review/regression.
 *
 * Rules encode what the UAT findings asked for, so a failure here is a UI
 * defect to fix, not a flaky test. They use soft assertions: one run lists
 * every broken field of every form.
 */

type TForm = {
	name: string;
	role: TRole;
	/** Opens the form and returns the element that contains it. */
	open: (page: Page) => Promise<Locator>;
	rules: TFieldRule[];
};

const dialog = (page: Page) => page.getByRole('dialog');

const FORMS: TForm[] = [
	{
		name: 'Produk (Barang baru)',
		role: 'admin',
		open: async (page) => {
			await page.goto('/products');
			await page.getByRole('button', { name: 'Barang baru' }).first().click();
			await expect(dialog(page)).toBeVisible();
			return dialog(page);
		},
		rules: [
			{ label: 'Nama', maxLength: 200, why: 'nama barang tanpa batas panjang' },
			{ label: 'Deskripsi', maxLength: 2000, why: 'deskripsi tanpa batas panjang' },
			{ label: 'Kode batang', maxLength: 64, why: 'kode batang tanpa batas panjang' },
			{ label: 'Harga jual', noLetters: true, bounded: true, why: 'temuan A4: harga tanpa batas' },
			{ label: 'Harga beli', noLetters: true, bounded: true, why: 'temuan A4: harga tanpa batas' },
			{ label: 'Stok minimum', noLetters: true, bounded: true, why: 'jumlah harus angka berbatas' },
		],
	},
	{
		name: 'Kategori baru',
		role: 'admin',
		open: async (page) => {
			await page.goto('/product-categories');
			await page.getByRole('button', { name: 'Kategori baru' }).click();
			await expect(dialog(page)).toBeVisible();
			return dialog(page);
		},
		rules: [
			{ label: 'Slug URL', maxLength: 64, why: 'slug berbatas 64' },
			{ label: 'Nama', maxLength: 120, why: 'nama kategori berbatas 120' },
			{ label: 'Urutan', noLetters: true, bounded: true, why: 'urutan 0–9999' },
		],
	},
	{
		name: 'Tambah penyimpanan (rak)',
		role: 'admin',
		open: async (page) => {
			await page.goto('/warehouses');
			await page.getByText('WH-MAIN').first().click();
			await page.getByRole('tab', { name: 'Penyimpanan' }).click();
			await page.getByRole('button', { name: 'Tambah penyimpanan' }).click();
			await expect(dialog(page)).toBeVisible();
			return dialog(page);
		},
		rules: [
			{ label: 'Kode', maxLength: 32, why: 'kode rak berbatas 32' },
			{ label: 'Nama', maxLength: 120, why: 'nama rak tanpa batas panjang' },
			{ label: 'Jenis', maxLength: 64, why: 'jenis rak tanpa batas panjang' },
			{ label: 'Kapasitas', noLetters: true, bounded: true, why: 'temuan A10: kapasitas perlu batas min/maks' },
		],
	},
	{
		name: 'Pemasok baru',
		role: 'purchasing_seed',
		open: async (page) => {
			await page.goto('/procurement/suppliers');
			await page.getByRole('button', { name: 'Pemasok baru' }).click();
			await expect(dialog(page)).toBeVisible();
			return dialog(page);
		},
		rules: [
			{ label: 'NPWP', digitsOnly: true, maxLength: 16, why: 'temuan B1: NPWP hanya angka' },
			{ label: 'Telepon', digitsOnly: true, maxLength: 15, why: 'temuan B1: telepon hanya angka, berbatas' },
			{ label: 'WhatsApp', digitsOnly: true, maxLength: 15, why: 'temuan B1: WhatsApp hanya angka, berbatas' },
			{ label: 'Tempo pembayaran (hari)', noLetters: true, bounded: true, why: 'temuan B1: tempo hanya angka' },
			{ label: 'Nomor rekening', digitsOnly: true, maxLength: 20, why: 'temuan B1: rekening hanya angka, berbatas' },
			{ label: 'Bank', choiceList: true, why: 'temuan B1: bank sebaiknya dropdown' },
		],
	},
	{
		name: 'Permintaan pembelian baru',
		role: 'technician_seed',
		open: async (page) => {
			await page.goto('/procurement/purchase-requests/new');
			await page.getByRole('button', { name: 'Tambah barang yang belum ada di daftar' }).click();
			const form = page.locator('main form').first();
			await expect(form).toBeVisible();
			return form;
		},
		rules: [
			{ label: 'Yang dibutuhkan', maxLength: 200, why: 'perihal berbatas 200' },
			{ label: 'Satuan', choiceList: true, why: 'temuan C1: satuan baris bebas sebaiknya dropdown' },
			{ label: 'Jumlah', noLetters: true, bounded: true, why: 'jumlah angka berbatas' },
		],
	},
	{
		name: 'Purchase order baru',
		role: 'purchasing_seed',
		open: async (page) => {
			await page.goto('/procurement/purchase-orders/new');
			const form = page.locator('main form').first();
			await expect(form).toBeVisible();
			return form;
		},
		rules: [
			{ label: 'Perihal', maxLength: 200, why: 'perihal berbatas 200' },
			{ label: 'Pemasok', choiceList: true, why: 'temuan D1: pemasok dipilih dari dropdown yang bisa dicari' },
		],
	},
];

for (const form of FORMS) {
	test.describe(`UI ${form.name}`, () => {
		let page: Page;

		test.beforeEach(async ({ browser }) => {
			page = await pageAs(browser, form.role);
		});

		test.afterEach(async () => {
			await page.context().close();
		});

		test('aturan isian (jenis input, batas, pilihan)', async ({ page: _unused }, testInfo) => {
			const scope = await form.open(page);
			await testInfo.attach('daftar kolom', {
				body: inventoryTable(await inventoryFields(scope)),
				contentType: 'text/markdown',
			});
			const fields = await inventoryFields(scope);
			const unlabeled = fields.filter((field) => field.label === '' && field.type !== 'checkbox').length;
			expect.soft(unlabeled, 'kolom tanpa label (tidak terbaca pembaca layar, tidak bisa diklik lewat label)').toBe(0);
			await checkFieldRules(scope, form.rules);
		});

		test('aksesibilitas (axe)', async ({ page: _unused }, testInfo) => {
			const scope = await form.open(page);
			const selector = (await scope.getAttribute('role')) === 'dialog' ? '[role="dialog"]' : 'main form';
			await checkAccessibility(page, selector, form.name, testInfo);
		});

		test('layar HP 390 px: tidak keluar layar', async () => {
			await page.setViewportSize({ width: 390, height: 844 });
			const scope = await form.open(page);
			await checkNoOverflow(page, scope, form.name);
		});

		test('screenshot desktop dan HP', async ({ page: _unused }, testInfo) => {
			const scope = await form.open(page);
			await testInfo.attach(`${form.name} desktop`, { body: await scope.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
			await expect(scope).toHaveScreenshot(`${form.name}-desktop.png`, {
				animations: 'disabled',
				mask: [scope.locator('input[type="date"]')],
				maxDiffPixelRatio: 0.01,
			});
			await page.setViewportSize({ width: 390, height: 844 });
			await page.waitForTimeout(300);
			await testInfo.attach(`${form.name} HP`, { body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png' });
		});
	});
}

test('toast tampil di depan dialog (temuan A1)', async ({ browser }) => {
	// A duplicate slug keeps the category dialog open and raises an error toast.
	const page = await pageAs(browser, 'admin');
	await page.goto('/product-categories');
	await page.getByRole('button', { name: 'Kategori baru' }).click();
	const open = dialog(page);
	await open.getByLabel('Slug URL').fill('uat-kabel');
	await open.getByLabel('Nama', { exact: true }).fill('Kabel duplikat UI');
	await open.getByRole('button', { name: 'Simpan' }).click();
	await checkToastOnTop(page, 'Kategori barang dengan slug ini sudah ada', 'Kategori, slug ganda');
	await page.context().close();
});
