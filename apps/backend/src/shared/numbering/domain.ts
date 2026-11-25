/**
 * Pure code-numbering rules — no I/O, no module.
 *
 * @remarks
 * Extracted from `code-number/domain/code-number.ts` when the shared
 * `code_number` schema was replaced by one `<schema>.code_numberings` table per
 * module (ADR-0024 Q6). Token grammar and formatting are unchanged; only the
 * code-type vocabulary moved to the new module names.
 *
 * Pattern tokens (closed set):
 *   {SEQ} / {SEQ:n}  sequence, optionally zero-padded to n digits (1-10)
 *   {TYPE}           code type code (QT, SO, INV, KW, ...)
 *   {COMPANY}        company document code from the company profile (`IMS`)
 *   {ORG}            slug of the issuing organization, upper-cased
 *                    (`pt-entragate-hit` -> `PT-ENTRAGATE-HIT`); every code type
 *   {MM}             month 01-12      {MM_ROMAN}  month I-XII
 *   {YY}             2-digit year     {YYYY}      4-digit year
 *   {SUPPLIER} {CATEGORY}  purchase orders only
 *   {CUSTOMER}       warranty certificates only
 * Dates are business dates in Asia/Jakarta.
 */

export const BUSINESS_TIME_ZONE = 'Asia/Jakarta';

/** Counter restart policies (the `reset_policy` CHECK). */
export const RESET_POLICIES = ['never', 'yearly', 'monthly'] as const;

export type ResetPolicy = (typeof RESET_POLICIES)[number];

/** Every code type any module allocates, grouped by owning schema. */
export const CODE_TYPES_BY_SCHEMA = {
	customer: ['customer', 'customer_company'],
	supplier: ['supplier_company'],
	// Split out of inventory by ADR-0026.
	product: ['item_product', 'item_material', 'item_component'],
	warehouse: ['warehouse'],
	inventory: [
		'asset',
		'stock_movement',
		'stock_adjustment',
		'borrowing',
		'maintenance',
		'disposal',
		'tool_set',
	],
	sale: [
		'quotation',
		'order',
		'delivery_note',
		'invoice',
		'receipt',
		'return',
	],
	procurement: [
		'purchase_request',
		'purchase_order',
		'goods_receipt',
		'purchase_return',
	],
	finance: [
		'journal_entry',
		'supplier_bill',
		'expense_claim',
		'cash_bank_transaction',
		'bank_reconciliation',
		'asset_depreciation',
		// Employees' salary payee accounts in cash_bank_accounts (ERP-0119).
		'employee_bank_account',
		// Credit notes against issued invoices (ERP-0135).
		'credit_memo',
		// Employee advances and their settlements (ERP-0144).
		'employee_advance',
		'expense_settlement',
	],
	tax: ['tax_record', 'withholding_tax_record'],
	payment: ['payment'],
	project: [
		'project',
		'bast',
		'warranty',
		'lead_reference',
		'license_contract',
		// Website references live with the leads they create (ADR-0024 Q12).
		'web_rfq',
		'web_contact',
		'web_demo',
	],
	ticket: ['ticket'],
	human_resource: ['employee'],
	document: ['document'],
} as const;

/** Every code type, flattened (for enums such as the document registry's documentType). */
export const CODE_TYPES = Object.values(CODE_TYPES_BY_SCHEMA).flat() as unknown as readonly [
	CodeType,
	...CodeType[],
];

export type CodeNumberingSchema = keyof typeof CODE_TYPES_BY_SCHEMA;
export type CodeType = (typeof CODE_TYPES_BY_SCHEMA)[CodeNumberingSchema][number];

export const CODE_TYPE_CODES: Record<CodeType, string> = {
	customer: 'CUS',
	customer_company: 'CMP',
	supplier_company: 'SUP',
	item_product: 'PRD',
	item_material: 'MAT',
	item_component: 'CMP',
	asset: 'AST',
	stock_movement: 'MV',
	stock_adjustment: 'ADJ',
	borrowing: 'BRW',
	maintenance: 'MNT',
	disposal: 'DSP',
	warehouse: 'WH',
	tool_set: 'TST',
	quotation: 'QT',
	order: 'SO',
	delivery_note: 'SJ',
	invoice: 'INV',
	receipt: 'KW',
	return: 'RTJ',
	web_rfq: 'RFQ',
	web_contact: 'MSG',
	web_demo: 'DEMO',
	purchase_request: 'PR',
	purchase_order: 'PO',
	goods_receipt: 'BPB',
	purchase_return: 'RTB',
	journal_entry: 'JE',
	supplier_bill: 'SB',
	expense_claim: 'EC',
	cash_bank_transaction: 'CB',
	bank_reconciliation: 'REC',
	asset_depreciation: 'DEP',
	employee_bank_account: 'REK',
	credit_memo: 'CN',
	employee_advance: 'ADV',
	expense_settlement: 'SET',
	tax_record: 'TAX',
	withholding_tax_record: 'WHT',
	payment: 'PAY',
	project: 'PRJ',
	bast: 'BAST',
	warranty: 'SG-GARANSI',
	lead_reference: 'LEAD',
	license_contract: 'LIC',
	ticket: 'TKT',
	employee: 'EMP',
	document: 'DOC',
};

export const DEFAULT_PATTERN = '{SEQ:4}/{TYPE}/{COMPANY}/{MM_ROMAN}/{YY}';
/** Website references follow the website's format, e.g. `RFQ-2026-00123`. */
export const WEB_REFERENCE_PATTERN = '{TYPE}-{YYYY}-{SEQ:5}';
/** Company PO format, e.g. `PO/IMS-HIT/HW/1026/001`. */
export const PURCHASE_ORDER_PATTERN =
	'{TYPE}/{COMPANY}-{SUPPLIER}/{CATEGORY}/{MM}{YY}/{SEQ:3}';
/** Company BAST format, e.g. `001/BAST/IMS/XII/2026`. */
export const BAST_PATTERN = '{SEQ:3}/{TYPE}/{COMPANY}/{MM_ROMAN}/{YYYY}';
/** Warranty certificate format, e.g. `001/SG-GARANSI/IMS-APP/2025`. */
export const WARRANTY_PATTERN = '{SEQ:3}/{TYPE}/{COMPANY}-{CUSTOMER}/{YYYY}';

/**
 * Codes that keep the shape they had under ERP-0009 (`MV-202611-000042`,
 * `AST-000123`, `BRW-202611-0001`), now as patterns of the numbering service.
 */
const FIXED_PATTERNS: Partial<
	Record<CodeType, { pattern: string; reset: ResetPolicy }>
> = {
	stock_movement: { pattern: '{TYPE}-{YYYY}{MM}-{SEQ:6}', reset: 'never' },
	asset: { pattern: '{TYPE}-{SEQ:6}', reset: 'never' },
	maintenance: { pattern: '{TYPE}-{YYYY}-{SEQ:5}', reset: 'yearly' },
	disposal: { pattern: '{TYPE}-{YYYY}-{SEQ:5}', reset: 'yearly' },
	tool_set: { pattern: '{TYPE}-{SEQ:5}', reset: 'never' },
	borrowing: { pattern: '{TYPE}-{YYYY}{MM}-{SEQ:4}', reset: 'monthly' },
	// ADR-0026: product and warehouse codes carry the issuing company.
	warehouse: { pattern: '{TYPE}-{COMPANY}-{SEQ:4}', reset: 'never' },
	item_product: { pattern: '{TYPE}-{COMPANY}-{SEQ:5}', reset: 'never' },
	item_material: { pattern: '{TYPE}-{COMPANY}-{SEQ:5}', reset: 'never' },
	item_component: { pattern: '{TYPE}-{COMPANY}-{SEQ:5}', reset: 'never' },
	customer: { pattern: '{TYPE}-{SEQ:5}', reset: 'never' },
	customer_company: { pattern: '{TYPE}-{SEQ:5}', reset: 'never' },
	// Generated supplier codes name the company and the organization that
	// registered the supplier, e.g. `IMS-PT-ENTRAGATE-SUP-00001`.
	supplier_company: { pattern: '{COMPANY}-{ORG}-{TYPE}-{SEQ:5}', reset: 'never' },
	lead_reference: { pattern: '{TYPE}-{YYYY}-{SEQ:5}', reset: 'yearly' },
	employee: { pattern: '{TYPE}-{SEQ:5}', reset: 'never' },
};

/**
 * Length of the column a generated code is stored in, for the code types whose
 * column is shorter than any pattern can render. A longer code is rejected
 * instead of being cut off (customer and supplier codes are varchar(32)).
 */
export const CODE_MAX_LENGTH: Partial<Record<CodeType, number>> = {
	customer: 32,
	customer_company: 32,
	supplier_company: 32,
};

/** Default pattern per code type (used until the owner overrides it). */
export function defaultPattern(codeType: CodeType): string {
	const fixed = FIXED_PATTERNS[codeType];
	if (fixed) return fixed.pattern;
	if (codeType === 'purchase_order') return PURCHASE_ORDER_PATTERN;
	if (codeType === 'bast') return BAST_PATTERN;
	if (codeType === 'warranty') return WARRANTY_PATTERN;
	return codeType.startsWith('web_') ? WEB_REFERENCE_PATTERN : DEFAULT_PATTERN;
}

/** Default reset policy per code type (PO sequences restart monthly). */
export function defaultResetPolicy(codeType: CodeType): ResetPolicy {
	const fixed = FIXED_PATTERNS[codeType];
	if (fixed) return fixed.reset;
	return codeType === 'purchase_order' ? 'monthly' : 'yearly';
}

/** Tokens filled from the document itself, allowed only for these types. */
const CONTEXT_TOKENS: Record<string, CodeType[]> = {
	SUPPLIER: ['purchase_order'],
	CATEGORY: ['purchase_order'],
	CUSTOMER: ['warranty'],
};

/** Per-document values for context tokens. */
export type TNumberContext = {
	supplier?: string;
	category?: string;
	customer?: string;
};

/** Placeholder context for previews (settings page). */
export const PREVIEW_CONTEXT: TNumberContext = {
	supplier: 'SUP',
	category: 'HW',
	customer: 'CUS',
};

/** Placeholder for `{ORG}` in a preview made without an active organization. */
export const PREVIEW_ORGANIZATION_CODE = 'ORG';

/** Allowed lengths of a pattern (the `pattern` column is varchar(100)). */
export const PATTERN_MAX_LENGTH = 100;

/** True when `pattern` contains the `{ORG}` token. */
export function usesOrganizationToken(pattern: string): boolean {
	return pattern.includes('{ORG}');
}

/**
 * The `{ORG}` value of an organization slug: upper-cased, every character
 * outside `A-Z 0-9 -` turned into `-`, repeated and edge dashes removed
 * (`pt entragate_hit` -> `PT-ENTRAGATE-HIT`).
 */
export function organizationCodeFromSlug(slug: string): string {
	return slug
		.toUpperCase()
		.replace(/[^A-Z0-9-]+/g, '-')
		.replace(/-{2,}/g, '-')
		.replace(/^-|-$/g, '');
}

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
	'ORG',
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
const ROMAN = [
	'I',
	'II',
	'III',
	'IV',
	'V',
	'VI',
	'VII',
	'VIII',
	'IX',
	'X',
	'XI',
	'XII',
];

/**
 * Returns the problems of a pattern; empty array = valid. Context tokens
 * ({SUPPLIER}, {CATEGORY}, {CUSTOMER}) are only valid for the code types that
 * provide them.
 */
export function validatePattern(
	pattern: string,
	codeType: CodeType,
): TPatternProblem[] {
	const problems: TPatternProblem[] = [];
	if (pattern.length === 0 || pattern.length > PATTERN_MAX_LENGTH)
		problems.push({ code: 'length' });
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
			problems.push({
				code: 'tokenNotForType',
				params: { token, types: allowedFor.join(', ') },
			});
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
	const get = (type: string) =>
		Number(parts.find((p) => p.type === type)?.value);
	return { year: get('year'), month: get('month') };
}

/** Counter period: `2026` (yearly), `2026-10` (monthly), `all` (never). */
export function periodKey(resetPolicy: ResetPolicy, date: Date): string {
	if (resetPolicy === 'never') return 'all';
	const { year, month } = businessYearMonth(date);
	return resetPolicy === 'yearly'
		? String(year)
		: `${year}-${String(month).padStart(2, '0')}`;
}

export function renderNumber(
	pattern: string,
	values: {
		seq: number;
		typeCode: string;
		companyCode: string;
		/** `{ORG}` value; only read when the pattern uses the token. */
		organizationCode?: string;
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
			case 'ORG':
				return values.organizationCode ?? '';
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
