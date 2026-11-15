/**
 * Pure code-number formatting rules. No I/O.
 *
 * Pattern tokens (closed set):
 *   {SEQ} / {SEQ:n}  sequence, optionally zero-padded to n digits (1-10)
 *   {TYPE}           code type code (QT, SO, INV, KW, …)
 *   {COMPANY}        company document code from the company profile (`IMS`)
 *   {MM}             month 01-12      {MM_ROMAN}  month I-XII
 *   {YY}             2-digit year     {YYYY}      4-digit year
 *   {SUPPLIER} {CATEGORY}  purchase orders only: supplier code and
 *                    purchase category code (e.g. HW), from the document
 *   {CUSTOMER}       warranty certificates only: customer code
 * Dates are business dates in Asia/Jakarta.
 */
import type { CodeType, ResetPolicy } from '@drizzle/schemas/code-number.schema';

export const BUSINESS_TIME_ZONE = 'Asia/Jakarta';

export const CODE_TYPE_CODES: Record<CodeType, string> = {
	quotation: 'QT',
	sales_order: 'SO',
	sales_invoice: 'INV',
	receipt: 'KW',
	web_rfq: 'RFQ',
	web_contact: 'MSG',
	web_demo: 'DEMO',
	purchase_order: 'PO',
	goods_receipt: 'BPB',
	stock_adjustment: 'ADJ',
	delivery_note: 'SJ',
	project: 'PRJ',
	bast: 'BAST',
	warranty: 'SG-GARANSI',
	service_ticket: 'TKT',
	license_contract: 'LIC',
	stock_movement: 'MV',
	asset: 'AST',
	asset_maintenance: 'MNT',
	asset_disposal: 'DSP',
	asset_tool_set: 'TST',
	asset_borrowing: 'BRW',
	bank_reconciliation: 'REC',
	cash_bank_transaction: 'CB',
	payment: 'PAY',
	journal_entry: 'JE',
	supplier_bill: 'SB',
	employee: 'EMP',
	warehouse: 'WH',
	item_product: 'PRD',
	item_material: 'MAT',
	item_component: 'CMP',
	purchase_return: 'RTB',
};

/** Module that owns each code type (`code_number.series.module`). */
export const CODE_TYPE_MODULES: Record<CodeType, string> = {
	quotation: 'sales',
	sales_order: 'sales',
	sales_invoice: 'sales',
	receipt: 'sales',
	web_rfq: 'crm',
	web_contact: 'crm',
	web_demo: 'crm',
	purchase_order: 'procurement',
	goods_receipt: 'procurement',
	stock_adjustment: 'inventory',
	delivery_note: 'inventory',
	project: 'projects',
	bast: 'projects',
	warranty: 'aftersales',
	service_ticket: 'aftersales',
	license_contract: 'licensing',
	stock_movement: 'inventory',
	asset: 'assets',
	asset_maintenance: 'assets',
	asset_disposal: 'assets',
	asset_tool_set: 'assets',
	asset_borrowing: 'assets',
	bank_reconciliation: 'accounting',
	cash_bank_transaction: 'accounting',
	payment: 'accounting',
	journal_entry: 'accounting',
	supplier_bill: 'accounting',
	employee: 'hr',
	warehouse: 'inventory',
	item_product: 'inventory',
	item_material: 'inventory',
	item_component: 'inventory',
	purchase_return: 'procurement',
};

export const DEFAULT_PATTERN = '{SEQ:4}/{TYPE}/{COMPANY}/{MM_ROMAN}/{YY}';
/** Website references follow the website's format, e.g. `RFQ-2026-00123`. */
export const WEB_REFERENCE_PATTERN = '{TYPE}-{YYYY}-{SEQ:5}';
/** Company PO format, e.g. `PO/IMS-HIT/HW/1026/001`. */
export const PURCHASE_ORDER_PATTERN = '{TYPE}/{COMPANY}-{SUPPLIER}/{CATEGORY}/{MM}{YY}/{SEQ:3}';
/** Company BAST format, e.g. `001/BAST/IMS/XII/2026`. */
export const BAST_PATTERN = '{SEQ:3}/{TYPE}/{COMPANY}/{MM_ROMAN}/{YYYY}';
/** Warranty certificate format, e.g. `001/SG-GARANSI/IMS-APP/2025`. */
export const WARRANTY_PATTERN = '{SEQ:3}/{TYPE}/{COMPANY}-{CUSTOMER}/{YYYY}';

/**
 * Inventory and asset codes keep the shape they had under ERP-0009
 * (`MV-202611-000042`, `AST-000123`, `BRW-202611-0001`), now as patterns of
 * the one numbering service.
 */
const INVENTORY_PATTERNS: Partial<Record<CodeType, { pattern: string; reset: ResetPolicy }>> = {
	stock_movement: { pattern: '{TYPE}-{YYYY}{MM}-{SEQ:6}', reset: 'never' },
	asset: { pattern: '{TYPE}-{SEQ:6}', reset: 'never' },
	asset_maintenance: { pattern: '{TYPE}-{YYYY}-{SEQ:5}', reset: 'yearly' },
	asset_disposal: { pattern: '{TYPE}-{YYYY}-{SEQ:5}', reset: 'yearly' },
	asset_tool_set: { pattern: '{TYPE}-{SEQ:5}', reset: 'never' },
	asset_borrowing: { pattern: '{TYPE}-{YYYY}{MM}-{SEQ:4}', reset: 'monthly' },
	warehouse: { pattern: '{TYPE}-{SEQ:4}', reset: 'never' },
	// ERP-0043: item master codes per kind, company-wide and never reset.
	item_product: { pattern: '{TYPE}-{SEQ:5}', reset: 'never' },
	item_material: { pattern: '{TYPE}-{SEQ:5}', reset: 'never' },
	item_component: { pattern: '{TYPE}-{SEQ:5}', reset: 'never' },
};

/** Default pattern per code type (used until the owner overrides it). */
export function defaultPattern(codeType: CodeType): string {
	const inventory = INVENTORY_PATTERNS[codeType];
	if (inventory) return inventory.pattern;
	if (codeType === 'purchase_order') return PURCHASE_ORDER_PATTERN;
	if (codeType === 'bast') return BAST_PATTERN;
	if (codeType === 'warranty') return WARRANTY_PATTERN;
	if (codeType === 'employee') return '{TYPE}-{SEQ:5}';
	return codeType.startsWith('web_') ? WEB_REFERENCE_PATTERN : DEFAULT_PATTERN;
}

/** Default reset policy per code type (PO sequences restart monthly). */
export function defaultResetPolicy(codeType: CodeType): ResetPolicy {
	const inventory = INVENTORY_PATTERNS[codeType];
	if (inventory) return inventory.reset;
	return codeType === 'purchase_order' ? 'monthly'
		: codeType === 'employee' ? 'never'
		: 'yearly';
}

/** Tokens filled from the document itself, allowed only for these types. */
const CONTEXT_TOKENS: Record<string, CodeType[]> = {
	SUPPLIER: ['purchase_order'],
	CATEGORY: ['purchase_order'],
	CUSTOMER: ['warranty'],
};

/** Per-document values for context tokens. */
export type TNumberContext = { supplier?: string; category?: string; customer?: string };

/** Placeholder context for previews (settings page). */
export const PREVIEW_CONTEXT: TNumberContext = { supplier: 'SUP', category: 'HW', customer: 'CUS' };

/**
 * One problem with a pattern. `code` maps to the locale key
 * `numbering.pattern.<code>`; `params` fill its placeholders.
 */
export type TPatternProblem = {
	code:
		| 'length'
		| 'unknownToken'
		| 'tokenNotForType'
		| 'tokenTakesNoWidth'
		| 'seqWidth'
		| 'seqOnce'
		| 'braces'
		| 'literals';
	params?: Record<string, string>;
};

const TOKEN_RE = /\{([A-Z_]+)(?::(\d+))?\}/g;
const KNOWN_TOKENS = new Set([
	'SEQ',
	'TYPE',
	'COMPANY',
	'MM',
	'MM_ROMAN',
	'YY',
	'YYYY',
	'SUPPLIER',
	'CATEGORY',
	'CUSTOMER',
]);
/** Characters allowed outside tokens. */
const LITERAL_RE = /^[A-Za-z0-9/\-._ ]*$/;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/**
 * Returns the problems of a pattern; empty array = valid. Context tokens
 * ({SUPPLIER}, {CATEGORY}, {CUSTOMER}) are only valid for the code types
 * that provide them.
 */
export function validatePattern(pattern: string, codeType: CodeType): TPatternProblem[] {
	const problems: TPatternProblem[] = [];
	if (pattern.length === 0 || pattern.length > 100) problems.push({ code: 'length' });
	let seqCount = 0;
	for (const match of pattern.matchAll(TOKEN_RE)) {
		const [, name, width] = match;
		const token = `{${name}}`;
		if (!KNOWN_TOKENS.has(name)) {
			problems.push({ code: 'unknownToken', params: { token } });
			continue;
		}
		const allowedFor = CONTEXT_TOKENS[name];
		if (allowedFor && !allowedFor.includes(codeType)) {
			problems.push({ code: 'tokenNotForType', params: { token, types: allowedFor.join(', ') } });
		}
		if (width !== undefined && name !== 'SEQ') {
			problems.push({ code: 'tokenTakesNoWidth', params: { token } });
		}
		if (name === 'SEQ') {
			seqCount += 1;
			const n = width === undefined ? 1 : Number(width);
			if (n < 1 || n > 10) problems.push({ code: 'seqWidth' });
		}
	}
	if (seqCount !== 1) problems.push({ code: 'seqOnce' });
	const literals = pattern.replace(TOKEN_RE, '');
	if (literals.includes('{') || literals.includes('}')) {
		problems.push({ code: 'braces' });
	} else if (!LITERAL_RE.test(literals)) {
		problems.push({ code: 'literals' });
	}
	return problems;
}

/** Year/month of `date` as seen in Asia/Jakarta. */
export function businessYearMonth(date: Date): { year: number; month: number } {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: BUSINESS_TIME_ZONE,
		year: 'numeric',
		month: 'numeric',
	}).formatToParts(date);
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
	return { year: get('year'), month: get('month') };
}

/** Counter period: `2026` (yearly), `2026-10` (monthly), `all` (never). */
export function periodKey(resetPolicy: ResetPolicy, date: Date): string {
	if (resetPolicy === 'never') return 'all';
	const { year, month } = businessYearMonth(date);
	return resetPolicy === 'yearly' ? String(year) : `${year}-${String(month).padStart(2, '0')}`;
}

export function renderNumber(
	pattern: string,
	values: {
		seq: number;
		typeCode: string;
		companyCode: string;
		date: Date;
		context?: TNumberContext;
	},
): string {
	const { year, month } = businessYearMonth(values.date);
	return pattern.replace(TOKEN_RE, (_, name: string, width?: string) => {
		switch (name) {
			case 'SEQ':
				return String(values.seq).padStart(width ? Number(width) : 1, '0');
			case 'TYPE':
				return values.typeCode;
			case 'COMPANY':
				return values.companyCode;
			case 'MM':
				return String(month).padStart(2, '0');
			case 'MM_ROMAN':
				return ROMAN[month - 1];
			case 'YY':
				return String(year % 100).padStart(2, '0');
			case 'YYYY':
				return String(year);
			case 'SUPPLIER':
				return values.context?.supplier ?? '';
			case 'CATEGORY':
				return values.context?.category ?? '';
			case 'CUSTOMER':
				return values.context?.customer ?? '';
			default:
				return '';
		}
	});
}
