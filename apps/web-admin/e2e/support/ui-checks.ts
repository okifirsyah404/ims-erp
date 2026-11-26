import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

/** A rule for one form control, found by its visible label. */
export type TFieldRule = {
	label: string;
	/** Which match to use when several controls share the label. */
	nth?: number;
	/** Only digits survive typing (NPWP, phone, account number). */
	digitsOnly?: boolean;
	/** Typed letters are refused (money, quantity). */
	noLetters?: boolean;
	/** The control must cap the length at most this many characters. */
	maxLength?: number;
	/** A huge number must be refused or capped (money/quantity fields). */
	bounded?: boolean;
	/** The control must be a choice list, not free text. */
	choiceList?: boolean;
	/** Why the rule exists (finding id or business reason), shown on failure. */
	why: string;
};

const HUGE = '9999999999999999999';

/**
 * Applies UI rules to the controls of an open form, as soft assertions so one
 * run lists every broken field instead of stopping at the first.
 */
export async function checkFieldRules(scope: Locator, rules: TFieldRule[]): Promise<void> {
	for (const rule of rules) {
		// Optional fields append "(Opsional)" to the label text.
		const escaped = rule.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const control = scope.getByLabel(new RegExp(`^\\s*${escaped}\\s*(\\(Opsional\\))?\\s*$`)).nth(rule.nth ?? 0);
		const name = `"${rule.label}" (${rule.why})`;
		if ((await control.count()) === 0) {
			expect.soft(false, `${name}: label tidak terhubung ke kolomnya (kolom tidak bisa ditemukan lewat label)`).toBe(true);
			continue;
		}
		if (rule.choiceList) {
			const role = await control.evaluate(
				(element) => element.getAttribute('role') ?? (element.tagName === 'SELECT' ? 'listbox' : element.tagName),
			);
			expect.soft(['combobox', 'listbox', 'button'].includes(role), `${name}: harus berupa pilihan (dropdown), sekarang teks bebas`).toBe(true);
			continue;
		}
		if (rule.digitsOnly || rule.noLetters) {
			await control.fill('');
			await control.pressSequentially('ab12');
			const value = await control.inputValue();
			expect.soft(/[a-z]/i.test(value), `${name}: huruf masih bisa diketik (nilai "${value}")`).toBe(false);
			await control.fill('');
		}
		if (rule.maxLength !== undefined) {
			const declared = await control.evaluate((element) =>
				'maxLength' in element && (element as HTMLInputElement).maxLength > 0 ? (element as HTMLInputElement).maxLength : null,
			);
			expect.soft(declared !== null && declared <= rule.maxLength, `${name}: batas panjang harus ≤ ${rule.maxLength}, sekarang ${declared ?? 'tidak ada'}`).toBe(true);
		}
		if (rule.bounded) {
			const attributes = await control.evaluate((element) => ({
				max: element.getAttribute('max'),
				maxLength: (element as HTMLInputElement).maxLength,
			}));
			await control.fill('');
			await control.pressSequentially(HUGE);
			const digits = (await control.inputValue()).replace(/\D/g, '');
			await control.fill('');
			const capped = digits.length < HUGE.length || attributes.max !== null || attributes.maxLength > 0;
			expect.soft(capped, `${name}: angka sangat besar (${HUGE}) diterima tanpa batas`).toBe(true);
		}
	}
}

/**
 * Asserts nothing in the open form spills past the viewport (phone width) and
 * the form itself does not scroll sideways.
 */
export async function checkNoOverflow(page: Page, scope: Locator, label: string): Promise<void> {
	const report = await scope.evaluate((root) => {
		const width = window.innerWidth;
		const spill = Array.from(root.querySelectorAll('input, textarea, select, button, label'))
			.map((element) => ({ element, box: element.getBoundingClientRect() }))
			.filter(({ box }) => box.width > 0 && (box.right > width + 1 || box.left < -1))
			.map(({ element }) => (element.textContent || element.getAttribute('aria-label') || element.id || element.tagName).trim().slice(0, 40));
		return { sideways: root.scrollWidth > root.clientWidth + 1, spill };
	});
	expect.soft(report.sideways, `${label}: form bergeser ke samping (scroll horizontal)`).toBe(false);
	expect.soft(report.spill, `${label}: elemen keluar layar`).toEqual([]);
	void page;
}

/**
 * Asserts the toast carrying `text` is the topmost thing at its own centre,
 * i.e. not hidden behind an open dialog (finding M05 A1).
 */
export async function checkToastOnTop(page: Page, text: string | RegExp, label: string): Promise<void> {
	// The app's own toast (`src/components/toast.tsx`) renders `role="status"`.
	// CSS, not getByRole: an open dialog marks everything outside it
	// aria-hidden, so a toast rendered outside the dialog vanishes from the
	// accessibility tree, which is part of the defect being checked.
	const toast = page.locator('[role="status"]').filter({ hasText: text }).first();
	await expect(toast, `${label}: toast "${text}" tidak muncul`).toBeAttached();
	const hidden = await toast.evaluate((element) => element.closest('[aria-hidden="true"], [inert]') !== null);
	expect.soft(hidden, `${label}: toast disembunyikan dari pembaca layar oleh dialog (aria-hidden/inert)`).toBe(false);
	const onTop = await toast.evaluate((element) => {
		const box = element.getBoundingClientRect();
		const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
		return top !== null && element.contains(top);
	});
	expect.soft(onTop, `${label}: toast tertutup dialog (tidak bisa dibaca/diklik)`).toBe(true);
}

/** Runs axe on the open form and attaches the violations to the report. */
export async function checkAccessibility(page: Page, selector: string, label: string, testInfo: TestInfo): Promise<void> {
	const result = await new AxeBuilder({ page }).include(selector).analyze();
	const lines = result.violations.map(
		(violation) => `- **${violation.id}** (${violation.impact}): ${violation.help}, ${violation.nodes.length} elemen`,
	);
	await testInfo.attach(`axe ${label}`, {
		body: lines.length ? lines.join('\n') : 'Tidak ada pelanggaran.',
		contentType: 'text/markdown',
	});
	const serious = result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
	expect.soft(serious.map((violation) => `${violation.id}: ${violation.help}`), `${label}: pelanggaran aksesibilitas serius`).toEqual([]);
}
