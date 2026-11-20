import { z } from 'zod';

/**
 * Employment type vocabulary, shared by the HR contract, the invite dialog's
 * permanent/temporary switch and the bulk-invite spreadsheet parser.
 *
 * @remarks
 * Mirrors the `hr.employees.employment_type` check constraint and
 * `EMPLOYMENT_TYPES` in the backend schema. Kept here (browser-safe) because
 * three separate layers must agree on the same five keys: the backend Zod
 * contract, the web-admin switch/labels and the template generator.
 *
 * The dialog's switch only distinguishes *permanent* (`permanent`) from
 * *temporary* (`contract`); the remaining types stay reachable through the HR
 * employee form and the spreadsheet column.
 */
export const employmentTypeNames = [
	'permanent',
	'contract',
	'probation',
	'internship',
	'outsourced',
] as const;

export type EmploymentTypeName = (typeof employmentTypeNames)[number];

/**
 * Display labels per UI language. Mirrors `hr:employmentType.*` in the locale
 * bundles; duplicated as data so non-React callers (spreadsheet errors) can
 * name a type without pulling a translation runtime in.
 */
export const employmentTypeLabels: Record<
	EmploymentTypeName,
	{ en: string; id: string }
> = {
	permanent: { en: 'Permanent', id: 'Tetap' },
	contract: { en: 'Contract', id: 'Kontrak' },
	probation: { en: 'Probation', id: 'Percobaan' },
	internship: { en: 'Internship', id: 'Magang' },
	outsourced: { en: 'Outsourced', id: 'Alih daya' },
};

/** True when `value` is a known employment type key. */
export function isEmploymentTypeName(
	value: string,
): value is EmploymentTypeName {
	return (employmentTypeNames as readonly string[]).includes(value);
}

/**
 * Zod schema for the closed employment-type enum. Wire payloads that carry an
 * employment type validate against this — unknown keys are a hard parse error.
 */
export const employmentTypeSchema = z.enum(employmentTypeNames);
