import type { Locator } from '@playwright/test';

/** What a form control looks like to the browser, for UI rule checks. */
export type TFieldInfo = {
	label: string;
	tag: string;
	type: string | null;
	inputMode: string | null;
	maxLength: number | null;
	min: string | null;
	max: string | null;
	required: boolean;
	/** The label shows the "(Opsional)" marker. */
	markedOptional: boolean;
	disabled: boolean;
};

/**
 * Lists every visible input, textarea and select inside `scope` with the
 * attributes UI rules care about, keyed by its label text.
 *
 * @remarks
 * The label is resolved the way a screen reader would: `<label for>`, then
 * `aria-label`, then a wrapping `<label>`. Controls without any label are
 * reported with an empty label, which is itself a finding.
 */
export async function inventoryFields(scope: Locator): Promise<TFieldInfo[]> {
	return scope.evaluate((root) => {
		const controls = Array.from(root.querySelectorAll('input, textarea, select')) as (
			| HTMLInputElement
			| HTMLTextAreaElement
			| HTMLSelectElement
		)[];
		const visible = controls.filter((control) => {
			if (control instanceof HTMLInputElement && ['hidden', 'file'].includes(control.type)) return false;
			const box = control.getBoundingClientRect();
			return box.width > 0 && box.height > 0;
		});
		return visible.map((control) => {
			const byFor = control.id ? root.ownerDocument.querySelector(`label[for="${CSS.escape(control.id)}"]`) : null;
			const wrapping = control.closest('label');
			const labelElement = byFor ?? wrapping;
			const rawLabel = labelElement?.textContent ?? control.getAttribute('aria-label') ?? '';
			const markedOptional = /\(Opsional\)|\(Optional\)/i.test(rawLabel);
			const label = rawLabel.replace(/\(Opsional\)|\(Optional\)/gi, '').replace(/\s+/g, ' ').trim();
			const maxLength = 'maxLength' in control && control.maxLength > 0 ? control.maxLength : null;
			return {
				label,
				tag: control.tagName.toLowerCase(),
				type: control instanceof HTMLInputElement ? control.type : null,
				inputMode: control.getAttribute('inputmode'),
				maxLength,
				min: control.getAttribute('min'),
				max: control.getAttribute('max'),
				required: control.required || control.getAttribute('aria-required') === 'true',
				markedOptional,
				disabled: control.disabled,
			};
		});
	});
}

/** Renders an inventory as a Markdown table for the HTML report. */
export function inventoryTable(fields: TFieldInfo[]): string {
	const head = '| Label | Elemen | type | inputmode | maxlength | min | max | wajib | (Opsional) |\n|---|---|---|---|---|---|---|---|---|';
	const rows = fields.map(
		(field) =>
			`| ${field.label || '**(tanpa label)**'} | ${field.tag} | ${field.type ?? ''} | ${field.inputMode ?? ''} | ${field.maxLength ?? ''} | ${field.min ?? ''} | ${field.max ?? ''} | ${field.required ? 'ya' : ''} | ${field.markedOptional ? 'ya' : ''} |`,
	);
	return [head, ...rows].join('\n');
}
