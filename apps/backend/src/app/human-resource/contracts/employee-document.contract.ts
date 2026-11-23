import type { TEmployeeAddressSelect } from '@drizzle/schemas/human-resource.schema';
import { z } from 'zod';

/**
 * Employee documents (ERP-0121, grill-me Q6/Q11-Q14/Q19-Q21): registry rows
 * of the document module with `module = human_resource`, `source_type =
 * employee`, `source_id = employees.id`. HR opens them, the document module
 * stores them and their files.
 */
export const EMPLOYEE_DOCUMENT_MODULE = 'human_resource';
export const EMPLOYEE_DOCUMENT_SOURCE = 'employee';

/** The document opened on every invite; its PDF is rendered after the claim. */
export const EMPLOYMENT_AGREEMENT = 'employment_agreement';

export const EMPLOYEE_DOCUMENT_TYPES = [EMPLOYMENT_AGREEMENT, 'id_card', 'tax_id', 'cv', 'certificate', 'other'] as const;
export type EmployeeDocumentType = (typeof EMPLOYEE_DOCUMENT_TYPES)[number];

export const employeeDocumentCreateSchema = z.object({
	documentType: z.enum(EMPLOYEE_DOCUMENT_TYPES),
	/** Defaults to the type's name plus the employee's name. */
	title: z
		.string()
		.trim()
		.max(200)
		.nullish()
		.transform((value) => (value ? value : null)),
});

export const employeeDocumentParamSchema = z.object({ id: z.uuid(), documentId: z.uuid() });
export const employeeDocumentFileParamSchema = employeeDocumentParamSchema.extend({ fileId: z.uuid() });

export type TEmployeeDocumentCreate = z.output<typeof employeeDocumentCreateSchema>;

/** Indonesian titles of the employee document types (business copy defaults to Indonesian). */
export const EMPLOYEE_DOCUMENT_TITLES: Record<EmployeeDocumentType, string> = {
	employment_agreement: 'Perjanjian Kerja',
	id_card: 'KTP',
	tax_id: 'NPWP',
	cv: 'Daftar Riwayat Hidup',
	certificate: 'Sertifikat',
	other: 'Dokumen',
};

/** The residence address an employee enters on the claim form. */
export type TEmployeeAddressInput = { addressLine: string; villageId: string; postalCode: string };

/** Persistence port of `human_resource.employee_addresses`. */
export interface IEmployeeAddressRepository {
	findPrimary(employeeId: string): Promise<TEmployeeAddressSelect | null>;
	/** Replaces the live primary residence address of the employee. */
	savePrimaryResidence(employeeId: string, input: TEmployeeAddressInput): Promise<TEmployeeAddressSelect>;
}

/** Enqueue seam of the employment-agreement PDF job; never throws into the caller. */
export interface IAgreementPdfQueue {
	enqueue(documentId: string): Promise<void>;
}
