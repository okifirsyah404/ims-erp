import { inject, injectable } from 'tsyringe';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, count, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { TPaginationResult } from '@ims-erp/common';
import { DRIZZLE_TOKEN } from '@di/provider';
import {
	assetConditionChecks,
	assetDepreciations,
	assetDisposals,
	assetDocuments,
	assetMaintenances,
	assetMovements,
	borrowingLines,
	borrowings,
	toolSetItems,
	toolSets,
	type TAssetConditionCheckSelect,
	type TAssetDepreciationSelect,
	type TAssetDisposalSelect,
	type TAssetDocumentSelect,
	type TAssetMaintenanceSelect,
	type TAssetMovementSelect,
	type TToolSetItemSelect,
	type TToolSetSelect,
} from '@drizzle/schemas/asset.schema';
import type { TTx } from '@drizzle/types';
import type {
	IAssetOperationsRepository,
} from '../contracts/asset-operations.repository.interface';

/** Shared pagination tail. */
const pageOf = <T>(
	page: number,
	limit: number,
	total: number,
	data: T[],
): TPaginationResult<T> => ({
	meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
	data,
});

/**
 * Persistence for the asset operation ledgers (Phase A-3).
 *
 * @remarks
 * Owns every SQL statement against the child tables of the asset register.
 * The two atomic claims (`claimForReturn`, `claimForExecution`) mirror the
 * Phase I-4 lesson: a conditional UPDATE inside the caller's transaction,
 * so concurrent transitions cannot double-execute.
 */
@injectable()
export class AssetOperationsRepository implements IAssetOperationsRepository {
	constructor(
		@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase,
	) {}

	/* ------------------------------ custody ------------------------------ */

	async findOpenBorrowingLine(
		assetId: string,
		tx?: TTx,
	): Promise<{ issuedAt: Date | null } | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.select({ issuedAt: borrowingLines.issuedAt })
			.from(borrowingLines)
			.innerJoin(borrowings, eq(borrowingLines.borrowingId, borrowings.id))
			.where(
				and(
					eq(borrowingLines.assetId, assetId),
					isNotNull(borrowingLines.issuedAt),
					isNull(borrowingLines.returnedAt),
					isNull(borrowingLines.markedLostAt),
					isNull(borrowingLines.deletedAt),
					isNull(borrowings.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async hasOpenMaintenance(assetId: string, tx?: TTx): Promise<boolean> {
		const db = tx ?? this.database;
		const [row] = await db
			.select({ value: count() })
			.from(assetMaintenances)
			.where(
				and(
					eq(assetMaintenances.assetId, assetId),
					isNull(assetMaintenances.deletedAt),
					inArray(assetMaintenances.status, ['scheduled', 'in_progress']),
				),
			);
		return row.value > 0;
	}

	/* ----------------------------- movements ----------------------------- */

	async createMovement(
		data: {
			organizationId: string;
			assetId: string;
			movementType: string;
			fromWarehouseId?: string | null;
			fromStorageId?: string | null;
			toWarehouseId?: string | null;
			toStorageId?: string | null;
			fromLocation?: string | null;
			toLocation?: string | null;
			movedAt: Date;
			movedByUserId?: string | null;
			condition?: string | null;
			notes?: string | null;
			createdAt: Date;
		},
		tx?: TTx,
	): Promise<TAssetMovementSelect> {
		const db = tx ?? this.database;
		const [row] = await db.insert(assetMovements).values(data).returning();
		return row;
	}

	async listMovements(
		assetId: string,
		organizationId: string,
		page: number,
		limit: number,
	): Promise<TPaginationResult<TAssetMovementSelect>> {
		const where = and(
			eq(assetMovements.assetId, assetId),
			eq(assetMovements.organizationId, organizationId),
			isNull(assetMovements.deletedAt),
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(assetMovements)
			.where(where);
		const data = await this.database
			.select()
			.from(assetMovements)
			.where(where)
			.orderBy(desc(assetMovements.movedAt))
			.limit(limit)
			.offset((page - 1) * limit);
		return pageOf(page, limit, total, data);
	}

	/* -------------------------- condition checks ------------------------- */

	async createConditionCheck(
		data: {
			organizationId: string;
			assetId: string;
			checkDate: string;
			condition: string;
			findings?: string | null;
			checkedByUserId?: string | null;
			nextCheckDate?: string | null;
			status?: string;
			createdAt: Date;
		},
		tx?: TTx,
	): Promise<TAssetConditionCheckSelect> {
		const db = tx ?? this.database;
		const [row] = await db.insert(assetConditionChecks).values(data).returning();
		return row;
	}

	async listConditionChecks(
		assetId: string,
		organizationId: string,
		page: number,
		limit: number,
	): Promise<TPaginationResult<TAssetConditionCheckSelect>> {
		const where = and(
			eq(assetConditionChecks.assetId, assetId),
			eq(assetConditionChecks.organizationId, organizationId),
			isNull(assetConditionChecks.deletedAt),
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(assetConditionChecks)
			.where(where);
		const data = await this.database
			.select()
			.from(assetConditionChecks)
			.where(where)
			.orderBy(desc(assetConditionChecks.checkDate))
			.limit(limit)
			.offset((page - 1) * limit);
		return pageOf(page, limit, total, data);
	}

	/* ---------------------------- maintenances --------------------------- */

	async createMaintenance(
		data: {
			organizationId: string;
			code: string;
			assetId: string;
			maintenanceType?: string;
			scheduledDate?: string | null;
			performedDate?: string | null;
			performedByEmployeeId?: string | null;
			vendorName?: string | null;
			cost?: number;
			currencyCode?: string;
			description?: string | null;
			status?: string;
			nextServiceDate?: string | null;
			documentId?: string | null;
			createdAt: Date;
		},
		tx?: TTx,
	): Promise<TAssetMaintenanceSelect> {
		const db = tx ?? this.database;
		const [row] = await db.insert(assetMaintenances).values(data).returning();
		return row;
	}

	async listMaintenances(
		assetId: string,
		organizationId: string,
		page: number,
		limit: number,
	): Promise<TPaginationResult<TAssetMaintenanceSelect>> {
		const where = and(
			eq(assetMaintenances.assetId, assetId),
			eq(assetMaintenances.organizationId, organizationId),
			isNull(assetMaintenances.deletedAt),
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(assetMaintenances)
			.where(where);
		const data = await this.database
			.select()
			.from(assetMaintenances)
			.where(where)
			.orderBy(desc(assetMaintenances.createdAt))
			.limit(limit)
			.offset((page - 1) * limit);
		return pageOf(page, limit, total, data);
	}

	/* --------------------------- depreciations --------------------------- */

	async findDepreciationPeriod(
		assetId: string,
		periodYear: number,
		periodMonth: number,
	): Promise<TAssetDepreciationSelect | null> {
		const [row] = await this.database
			.select()
			.from(assetDepreciations)
			.where(
				and(
					eq(assetDepreciations.assetId, assetId),
					eq(assetDepreciations.periodYear, periodYear),
					eq(assetDepreciations.periodMonth, periodMonth),
					isNull(assetDepreciations.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async createDepreciation(
		data: {
			organizationId: string;
			assetId: string;
			periodYear: number;
			periodMonth: number;
			depreciationMethod: string;
			depreciationAmount: number;
			openingBookValue: number;
			closingBookValue: number;
			currencyCode: string;
			calculatedAt?: Date | null;
			createdAt: Date;
		},
		tx?: TTx,
	): Promise<TAssetDepreciationSelect> {
		const db = tx ?? this.database;
		const [row] = await db.insert(assetDepreciations).values(data).returning();
		return row;
	}

	async listDepreciations(
		assetId: string,
		organizationId: string,
		page: number,
		limit: number,
	): Promise<TPaginationResult<TAssetDepreciationSelect>> {
		const where = and(
			eq(assetDepreciations.assetId, assetId),
			eq(assetDepreciations.organizationId, organizationId),
			isNull(assetDepreciations.deletedAt),
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(assetDepreciations)
			.where(where);
		const data = await this.database
			.select()
			.from(assetDepreciations)
			.where(where)
			.orderBy(desc(assetDepreciations.periodYear), desc(assetDepreciations.periodMonth))
			.limit(limit)
			.offset((page - 1) * limit);
		return pageOf(page, limit, total, data);
	}

	/* ------------------------------ disposals ---------------------------- */

	async createDisposal(
		data: {
			organizationId: string;
			code: string;
			assetId: string;
			disposalDate?: string | null;
			disposalMethod?: string;
			proceedsAmount?: number;
			currencyCode?: string;
			buyerName?: string | null;
			status?: string;
			requestedBy?: string | null;
			createdAt: Date;
		},
		tx?: TTx,
	): Promise<TAssetDisposalSelect> {
		const db = tx ?? this.database;
		const [row] = await db.insert(assetDisposals).values(data).returning();
		return row;
	}

	async findDisposalById(id: string): Promise<TAssetDisposalSelect | null> {
		const [row] = await this.database
			.select()
			.from(assetDisposals)
			.where(
				and(eq(assetDisposals.id, id), isNull(assetDisposals.deletedAt)),
			)
			.limit(1);
		return row ?? null;
	}

	async listDisposals(
		organizationId: string,
		page: number,
		limit: number,
	): Promise<TPaginationResult<TAssetDisposalSelect>> {
		const where = and(
			eq(assetDisposals.organizationId, organizationId),
			isNull(assetDisposals.deletedAt),
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(assetDisposals)
			.where(where);
		const data = await this.database
			.select()
			.from(assetDisposals)
			.where(where)
			.orderBy(desc(assetDisposals.createdAt))
			.limit(limit)
			.offset((page - 1) * limit);
		return pageOf(page, limit, total, data);
	}

	async updateDisposal(
		id: string,
		data: Partial<TAssetDisposalSelect>,
		tx?: TTx,
	): Promise<TAssetDisposalSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.update(assetDisposals)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(assetDisposals.id, id), isNull(assetDisposals.deletedAt)))
			.returning();
		return row ?? null;
	}

	async claimForExecution(
		id: string,
		tx: TTx,
	): Promise<TAssetDisposalSelect | null> {
		const [row] = await tx
			.update(assetDisposals)
			.set({ status: 'executed', executedAt: new Date(), updatedAt: new Date() })
			.where(
				and(
					eq(assetDisposals.id, id),
					eq(assetDisposals.status, 'approved'),
					isNull(assetDisposals.executedAt),
					isNull(assetDisposals.deletedAt),
				),
			)
			.returning();
		return row ?? null;
	}

	/* ------------------------------ documents ---------------------------- */

	async createDocument(
		data: {
			organizationId: string;
			assetId: string;
			documentId: string;
			documentType: string;
			createdAt: Date;
		},
		tx?: TTx,
	): Promise<TAssetDocumentSelect> {
		const db = tx ?? this.database;
		const [row] = await db.insert(assetDocuments).values(data).returning();
		return row;
	}

	async listDocuments(
		assetId: string,
		organizationId: string,
	): Promise<TAssetDocumentSelect[]> {
		return this.database
			.select()
			.from(assetDocuments)
			.where(
				and(
					eq(assetDocuments.assetId, assetId),
					eq(assetDocuments.organizationId, organizationId),
					isNull(assetDocuments.deletedAt),
				),
			)
			.orderBy(desc(assetDocuments.createdAt));
	}

	/* ------------------------------ tool sets ---------------------------- */

	async createToolSet(
		data: {
			organizationId: string;
			code: string;
			name: string;
			description?: string | null;
			custodianEmployeeId?: string | null;
			status?: string;
			createdAt: Date;
		},
		tx?: TTx,
	): Promise<TToolSetSelect> {
		const db = tx ?? this.database;
		const [row] = await db.insert(toolSets).values(data).returning();
		return row;
	}

	async findToolSetById(id: string): Promise<TToolSetSelect | null> {
		const [row] = await this.database
			.select()
			.from(toolSets)
			.where(and(eq(toolSets.id, id), isNull(toolSets.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async listToolSets(
		organizationId: string,
		page: number,
		limit: number,
	): Promise<TPaginationResult<TToolSetSelect>> {
		const where = and(
			eq(toolSets.organizationId, organizationId),
			isNull(toolSets.deletedAt),
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(toolSets)
			.where(where);
		const data = await this.database
			.select()
			.from(toolSets)
			.where(where)
			.orderBy(toolSets.code)
			.limit(limit)
			.offset((page - 1) * limit);
		return pageOf(page, limit, total, data);
	}

	async updateToolSet(
		id: string,
		data: Partial<TToolSetSelect>,
		tx?: TTx,
	): Promise<TToolSetSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.update(toolSets)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(toolSets.id, id), isNull(toolSets.deletedAt)))
			.returning();
		return row ?? null;
	}

	async archiveToolSet(id: string, tx?: TTx): Promise<TToolSetSelect | null> {
		const db = tx ?? this.database;
		const [row] = await db
			.update(toolSets)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(and(eq(toolSets.id, id), isNull(toolSets.deletedAt)))
			.returning();
		return row ?? null;
	}

	async listToolSetItems(toolSetId: string): Promise<TToolSetItemSelect[]> {
		return this.database
			.select()
			.from(toolSetItems)
			.where(
				and(
					eq(toolSetItems.toolSetId, toolSetId),
					isNull(toolSetItems.deletedAt),
				),
			)
			.orderBy(toolSetItems.createdAt);
	}

	async addToolSetItem(
		data: {
			organizationId: string;
			toolSetId: string;
			assetId: string;
			quantity: string;
			createdAt: Date;
		},
		tx?: TTx,
	): Promise<TToolSetItemSelect> {
		const db = tx ?? this.database;
		const [row] = await db.insert(toolSetItems).values(data).returning();
		return row;
	}

	async removeToolSetItem(
		toolSetId: string,
		itemId: string,
		tx?: TTx,
	): Promise<boolean> {
		const db = tx ?? this.database;
		const rows = await db
			.update(toolSetItems)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(
				and(
					eq(toolSetItems.id, itemId),
					eq(toolSetItems.toolSetId, toolSetId),
					isNull(toolSetItems.deletedAt),
				),
			)
			.returning();
		return rows.length > 0;
	}
}
