import { z } from 'zod';
import { documentItemSchema } from '@app/project/contracts/handover.contract';
import type { TPaginationRequest, TPaginationResult } from '@ims-erp/common';
import type { TWarrantyInsert, TWarrantySelect } from '@drizzle/schemas/project.schema';

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
	handoverId: z.uuid(),
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

/** Paginated certificate list (`GET /warranties`). */
export const warrantyListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z.string().trim().max(100).optional(),
});

export type TWarrantyBodyRequest = z.output<typeof warrantyBodySchema>;

export type TWarrantyData = Omit<TWarrantyInsert, 'id' | 'code' | 'createdBy' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

/** A certificate as listed across projects. */
export type TWarrantyRow = TWarrantySelect & { projectCode: string; customerName: string };

export type TWarrantyPaginationRequest = TPaginationRequest & { search?: string; involvedUserId?: string };

export type TWarrantyListQuery = z.output<typeof warrantyListQuerySchema>;

/** Persistence port for `aftersales.warranty_certificates` (live rows). */
export interface IWarrantyRepository {
	findByProject(projectId: string): Promise<TWarrantySelect | null>;
	/** Every live certificate of a customer, newest first (portal, ERP-0022). */
	listByCustomer(customerId: string): Promise<TWarrantySelect[]>;
	/** One page of certificates across the visible projects. */
	paginate(request: TWarrantyPaginationRequest): Promise<TPaginationResult<TWarrantyRow>>;
	create(code: string, actorUserId: string, data: TWarrantyData): Promise<TWarrantySelect>;
	update(id: string, data: TWarrantyData): Promise<TWarrantySelect | null>;
}
