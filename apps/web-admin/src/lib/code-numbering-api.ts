import type { TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import type { Permission } from '@/lib/permissions';
import { currentLanguage } from '@/i18n';

/**
 * API client for the code-numbering settings (ADR-0024 Q6).
 *
 * @remarks
 * There is no central numbering endpoint: every module that owns a
 * `<schema>.code_numberings` table serves the same three routes under its own
 * prefix (`GET {prefix}/code-numberings`, `POST .../:codeType/preview`,
 * `PUT .../:codeType`). The settings page walks {@link CODE_NUMBERING_SECTIONS}.
 *
 * Access (mirrors the backend `adminOrErpGuard`): an application admin sees
 * every section; an organization member needs `code_number.read` (and
 * `code_number.update` to change a series); `appAdminOnly` sections are for
 * application admins only.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const RESET_POLICIES = ['never', 'yearly', 'monthly'] as const;
export type TResetPolicy = (typeof RESET_POLICIES)[number];

/** Every code type any module allocates (the backend `CODE_TYPES_BY_SCHEMA`). */
export type TCodeType =
	| 'customer'
	| 'customer_company'
	| 'supplier_company'
	| 'item_product'
	| 'item_material'
	| 'item_component'
	| 'warehouse'
	| 'asset'
	| 'stock_movement'
	| 'stock_adjustment'
	| 'borrowing'
	| 'maintenance'
	| 'disposal'
	| 'tool_set'
	| 'quotation'
	| 'order'
	| 'delivery_note'
	| 'invoice'
	| 'receipt'
	| 'return'
	| 'purchase_request'
	| 'purchase_order'
	| 'goods_receipt'
	| 'purchase_return'
	| 'journal_entry'
	| 'supplier_bill'
	| 'cash_bank_transaction'
	| 'bank_reconciliation'
	| 'asset_depreciation'
	| 'employee_bank_account'
	| 'tax_record'
	| 'withholding_tax_record'
	| 'payment'
	| 'project'
	| 'bast'
	| 'warranty'
	| 'lead_reference'
	| 'license_contract'
	| 'web_rfq'
	| 'web_contact'
	| 'web_demo'
	| 'ticket'
	| 'employee'
	| 'document';

/** One numbering series as the API shows it. */
export type TCodeNumberSetting = {
	codeType: TCodeType;
	/** The `{TYPE}` value, e.g. `QT`. */
	typeCode: string;
	pattern: string;
	resetPolicy: TResetPolicy;
	/** True when no override is stored (code defaults apply). */
	isDefault: boolean;
	/** The number the next document would get (not reserved). */
	nextNumber: string;
	/** Column length the rendered code must fit, when limited. */
	maxLength: number | null;
};

export type TCodeNumberInput = { pattern: string; resetPolicy: TResetPolicy };

/** The schema that owns a numbering table (also the locale key suffix). */
export type TNumberingSchema =
	| 'customer'
	| 'supplier'
	| 'product'
	| 'warehouse'
	| 'inventory'
	| 'sale'
	| 'procurement'
	| 'finance'
	| 'tax'
	| 'payment'
	| 'project'
	| 'ticket'
	| 'human_resource'
	| 'document';

/** One card of the settings page. */
export type TCodeNumberingSection = {
	schema: TNumberingSchema;
	/** The owning module's URL prefix. */
	prefix: string;
	/** Only application admins may see and change this section. */
	appAdminOnly?: true;
};

/** Every `<schema>.code_numberings`, in the sidebar's module order. */
export const CODE_NUMBERING_SECTIONS: readonly TCodeNumberingSection[] = [
	{ schema: 'customer', prefix: '/customers' },
	{ schema: 'sale', prefix: '/sales' },
	{ schema: 'payment', prefix: '/payments' },
	{ schema: 'document', prefix: '/documents' },
	{ schema: 'project', prefix: '/projects' },
	{ schema: 'ticket', prefix: '/tickets' },
	{ schema: 'product', prefix: '/products' },
	// Warehouses are application-admin-only (ADR-0008).
	{ schema: 'warehouse', prefix: '/warehouses', appAdminOnly: true },
	{ schema: 'inventory', prefix: '/inventory' },
	{ schema: 'supplier', prefix: '/suppliers' },
	{ schema: 'procurement', prefix: '/procurement' },
	{ schema: 'human_resource', prefix: '/human-resources' },
	{ schema: 'finance', prefix: '/finance' },
	{ schema: 'tax', prefix: '/taxes' },
];

export const CODE_NUMBER_READ: Permission = 'code_number.read';
export const CODE_NUMBER_UPDATE: Permission = 'code_number.update';

/** Whether a section is visible (UX only; the backend re-checks). */
export function canSeeSection(
	section: TCodeNumberingSection,
	access: { isAppAdmin: boolean; canRead: boolean },
): boolean {
	if (access.isAppAdmin) return true;
	if (section.appAdminOnly) return false;
	return access.canRead;
}

/** Whether a section's series may be changed (UX only; the backend re-checks). */
export function canEditSection(
	section: TCodeNumberingSection,
	access: { isAppAdmin: boolean; canUpdate: boolean },
): boolean {
	if (access.isAppAdmin) return true;
	if (section.appAdminOnly) return false;
	return access.canUpdate;
}

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

export function codeNumberingQueryKey(section: TCodeNumberingSection) {
	return ['code-numberings', section.schema] as const;
}

export function codeNumberingQueryOptions(section: TCodeNumberingSection) {
	return queryOptions({
		queryKey: codeNumberingQueryKey(section),
		queryFn: () => request<TCodeNumberSetting[]>(`${section.prefix}/code-numberings`),
	});
}

/** Renders a pattern server-side (validated, nothing saved). */
export async function previewCodeNumber(
	section: TCodeNumberingSection,
	codeType: TCodeType,
	input: TCodeNumberInput,
): Promise<string> {
	const data = await request<{ nextNumber: string }>(
		`${section.prefix}/code-numberings/${encodeURIComponent(codeType)}/preview`,
		{ method: 'POST', body: JSON.stringify(input) },
	);
	return data.nextNumber;
}

export function saveCodeNumber(
	section: TCodeNumberingSection,
	codeType: TCodeType,
	input: TCodeNumberInput,
) {
	return request<TCodeNumberSetting>(
		`${section.prefix}/code-numberings/${encodeURIComponent(codeType)}`,
		{ method: 'PUT', body: JSON.stringify(input) },
	);
}
