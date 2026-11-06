import { z } from 'zod';
import { documentItemSchema } from '@app/projects/contracts/handover.contract';
import type { TWarrantyCertificateInsert, TWarrantyCertificateSelect } from '@drizzle/schemas/aftersales.schema';

/**
 * Request schema for warranty certificates
 * (`/warranty-certificates/projects/:projectId`, ADR-0011 step 6b).
 */

const name = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => (value ? value : null));

export const warrantyBodySchema = z.object({
	/** The BAST the warranty starts at. */
	bastId: z.uuid(),
	issueDate: z.iso.date(),
	months: z.number().int().min(1).max(120),
	productSummary: name(300),
	projectName: name(300),
	projectLocation: optionalText(200),
	projectOwner: name(200),
	items: z.array(documentItemSchema).min(1).max(100),
	coverage: name(6000),
	exclusions: name(6000),
	serviceTerms: name(6000),
});

export const warrantyProjectParamSchema = z.object({ projectId: z.uuid() });

export type TWarrantyBodyRequest = z.output<typeof warrantyBodySchema>;

export type TWarrantyData = Omit<TWarrantyCertificateInsert, 'id' | 'code' | 'createdBy' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

/** Persistence port for `aftersales.warranty_certificates` (live rows). */
export interface IWarrantyRepository {
	findByProject(projectId: string): Promise<TWarrantyCertificateSelect | null>;
	create(code: string, actorUserId: string, data: TWarrantyData): Promise<TWarrantyCertificateSelect>;
	update(id: string, data: TWarrantyData): Promise<TWarrantyCertificateSelect | null>;
}
