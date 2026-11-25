import type { TTx } from '@drizzle/types';
import { DRIZZLE_TOKEN } from '@di/provider';
import {
	taxCorrections,
	taxRecords,
	taxes,
	withholdingTaxRecords,
	type TTaxCorrectionSelect,
	type TTaxRecordSelect,
	type TTaxSelect,
	type TWithholdingTaxRecordSelect,
} from '@drizzle/schemas/tax.schema';
import type { TPaginationResult } from '@ims-erp/common';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { and, asc, count, eq, isNull, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import { paginationResult } from '@utils/pagination.util';
import type {
	TTaxPaginationRequest,
	TTaxRecordPaginationRequest,
	TTaxRepository,
} from '../contracts/tax.repository.interface';

/**
 * Drizzle implementation of the tax repository.
 *
 * @remarks
 * Tenant scope on every query. Soft-deleted rows are excluded. No cache: the
 * tax data is small and read by finance, so correctness beats a hit ratio.
 */
@injectable()
export class TaxRepository implements TTaxRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async findTaxTypesByCode(
		organizationId: string,
		code: string,
	): Promise<TTaxSelect[]> {
		return this.database
			.select()
			.from(taxes)
			.where(
				and(
					eq(taxes.organizationId, organizationId),
					eq(taxes.code, code),
					isNull(taxes.deletedAt),
				),
			)
			.orderBy(asc(taxes.effectiveFrom));
	}

	async paginateTaxTypes(
		request: TTaxPaginationRequest,
	): Promise<TPaginationResult<TTaxSelect>> {
		const { organizationId, page, limit } = request;
		const where = and(
			eq(taxes.organizationId, organizationId),
			isNull(taxes.deletedAt),
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(taxes)
			.where(where);
		const data = await this.database
			.select()
			.from(taxes)
			.where(where)
			.orderBy(asc(taxes.code), asc(taxes.effectiveFrom))
			.limit(limit)
			.offset((page - 1) * limit);
		return paginationResult(request, total, data);
	}

	async findTaxTypeById(
		organizationId: string,
		id: string,
	): Promise<TTaxSelect | null> {
		const [row] = await this.database
			.select()
			.from(taxes)
			.where(
				and(
					eq(taxes.id, id),
					eq(taxes.organizationId, organizationId),
					isNull(taxes.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async insertTaxType(row: {
		organizationId: string;
		code: string;
		name: string;
		taxType: string;
		rate: string;
		baseType: string;
		isInclusive: boolean;
		effectiveFrom: string;
		effectiveTo: string | null;
		isActive: boolean;
	}): Promise<TTaxSelect> {
		const now = new Date();
		const [created] = await this.database
			.insert(taxes)
			.values({
				...row,
				createdAt: now,
				updatedAt: now,
			})
			.returning();
		return created;
	}

	async updateTaxType(
		organizationId: string,
		id: string,
		patch: Partial<{
			name: string;
			isActive: boolean;
			effectiveTo: string | null;
		}>,
	): Promise<TTaxSelect | null> {
		const [row] = await this.database
			.update(taxes)
			.set({ ...patch, updatedAt: new Date() })
			.where(
				and(
					eq(taxes.id, id),
					eq(taxes.organizationId, organizationId),
					isNull(taxes.deletedAt),
				),
			)
			.returning();
		return row ?? null;
	}

	async softDeleteTaxType(organizationId: string, id: string): Promise<boolean> {
		const rows = await this.database
			.update(taxes)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(
				and(
					eq(taxes.id, id),
					eq(taxes.organizationId, organizationId),
					isNull(taxes.deletedAt),
				),
			)
			.returning({ id: taxes.id });
		return rows.length > 0;
	}

	async countReferencesToTaxType(
		organizationId: string,
		taxTypeId: string,
	): Promise<number> {
		const [records] = await this.database
			.select({ value: count() })
			.from(taxRecords)
			.where(
				and(
					eq(taxRecords.organizationId, organizationId),
					eq(taxRecords.taxTypeId, taxTypeId),
					isNull(taxRecords.deletedAt),
				),
			);
		const [withholding] = await this.database
			.select({ value: count() })
			.from(withholdingTaxRecords)
			.where(
				and(
					eq(withholdingTaxRecords.organizationId, organizationId),
					eq(withholdingTaxRecords.taxTypeId, taxTypeId),
					isNull(withholdingTaxRecords.deletedAt),
				),
			);
		return Number(records.value) + Number(withholding.value);
	}

	async paginateTaxRecords(
		request: TTaxRecordPaginationRequest,
	): Promise<TPaginationResult<TTaxRecordSelect>> {
		const { organizationId, year, month, page, limit } = request;
		const conditions = [
			eq(taxRecords.organizationId, organizationId),
			isNull(taxRecords.deletedAt),
		];
		if (year !== undefined) {
			conditions.push(eq(taxRecords.periodYear, year));
		}
		if (month !== undefined) {
			conditions.push(eq(taxRecords.periodMonth, month));
		}
		const where = and(...conditions);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(taxRecords)
			.where(where);
		const data = await this.database
			.select()
			.from(taxRecords)
			.where(where)
			.orderBy(asc(taxRecords.periodYear), asc(taxRecords.periodMonth))
			.limit(limit)
			.offset((page - 1) * limit);
		return paginationResult(request, total, data);
	}

	async findTaxRecordById(
		organizationId: string,
		id: string,
	): Promise<TTaxRecordSelect | null> {
		const [row] = await this.database
			.select()
			.from(taxRecords)
			.where(
				and(
					eq(taxRecords.id, id),
					eq(taxRecords.organizationId, organizationId),
					isNull(taxRecords.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async findTaxRecordByPeriod(
		organizationId: string,
		taxTypeId: string,
		year: number,
		month: number,
	): Promise<TTaxRecordSelect | null> {
		const [row] = await this.database
			.select()
			.from(taxRecords)
			.where(
				and(
					eq(taxRecords.organizationId, organizationId),
					eq(taxRecords.taxTypeId, taxTypeId),
					eq(taxRecords.periodYear, year),
					eq(taxRecords.periodMonth, month),
					isNull(taxRecords.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async insertTaxRecord(row: {
		organizationId: string;
		code: string;
		taxTypeId: string;
		periodYear: number;
		periodMonth: number;
		taxableBase: number;
		taxAmount: number;
		notes: string | null;
	}): Promise<TTaxRecordSelect> {
		const now = new Date();
		const [created] = await this.database
			.insert(taxRecords)
			.values({ ...row, createdAt: now, updatedAt: now })
			.returning();
		return created;
	}

	async updateDraftTaxRecord(
		organizationId: string,
		id: string,
		patch: Partial<{ taxableBase: number; taxAmount: number; notes: string | null }>,
	): Promise<TTaxRecordSelect | null> {
		const [row] = await this.database
			.update(taxRecords)
			.set({ ...patch, updatedAt: new Date() })
			.where(
				and(
					eq(taxRecords.id, id),
					eq(taxRecords.organizationId, organizationId),
					eq(taxRecords.filingStatus, 'draft'),
					isNull(taxRecords.deletedAt),
				),
			)
			.returning();
		return row ?? null;
	}

	async transitionTaxRecord(
		organizationId: string,
		id: string,
		from: string,
		to: string,
		extra: { verifiedBy?: string | null; filedOn?: string | null },
	): Promise<TTaxRecordSelect | null> {
		const [row] = await this.database
			.update(taxRecords)
			.set({
				filingStatus: to,
				updatedAt: new Date(),
				...(extra.verifiedBy !== undefined ? { verifiedBy: extra.verifiedBy } : {}),
				...(extra.filedOn !== undefined ? { filedOn: extra.filedOn } : {}),
			})
			.where(
				and(
					eq(taxRecords.id, id),
					eq(taxRecords.organizationId, organizationId),
					eq(taxRecords.filingStatus, from),
					isNull(taxRecords.deletedAt),
				),
			)
			.returning();
		return row ?? null;
	}

	async listCorrections(
		organizationId: string,
		taxRecordId: string,
	): Promise<TTaxCorrectionSelect[]> {
		return this.database
			.select()
			.from(taxCorrections)
			.where(
				and(
					eq(taxCorrections.organizationId, organizationId),
					eq(taxCorrections.taxRecordId, taxRecordId),
					isNull(taxCorrections.deletedAt),
				),
			)
			.orderBy(asc(taxCorrections.createdAt));
	}

	async insertCorrection(row: {
		organizationId: string;
		taxRecordId: string;
		amount: number;
		reason: string;
		evidenceDocumentId: string | null;
		createdBy: string;
	}): Promise<TTaxCorrectionSelect> {
		const now = new Date();
		const [created] = await this.database
			.insert(taxCorrections)
			.values({ ...row, createdAt: now, updatedAt: now })
			.returning();
		return created;
	}

	async recapForPeriod(
		organizationId: string,
		year: number,
		month: number,
	): Promise<
		Array<{
			taxRecordId: string;
			taxTypeId: string;
			code: string;
			taxableBase: number;
			taxAmount: number;
			correctionTotal: number;
			filingStatus: string;
		}>
	> {
		// Corrections are summed in SQL as bigint, so the totals never pass
		// through floats. Soft-deleted corrections are excluded.
		const rows = await this.database
			.select({
				taxRecordId: taxRecords.id,
				taxTypeId: taxRecords.taxTypeId,
				code: taxRecords.code,
				taxableBase: taxRecords.taxableBase,
				taxAmount: taxRecords.taxAmount,
				filingStatus: taxRecords.filingStatus,
				correctionTotal: sql<string>`COALESCE(SUM(${taxCorrections.amount}) FILTER (WHERE ${taxCorrections.deletedAt} IS NULL), 0)`,
			})
			.from(taxRecords)
			.leftJoin(
				taxCorrections,
				and(
					eq(taxCorrections.taxRecordId, taxRecords.id),
					eq(taxCorrections.organizationId, organizationId),
				),
			)
			.where(
				and(
					eq(taxRecords.organizationId, organizationId),
					eq(taxRecords.periodYear, year),
					eq(taxRecords.periodMonth, month),
					isNull(taxRecords.deletedAt),
				),
			)
			.groupBy(
				taxRecords.id,
				taxRecords.taxTypeId,
				taxRecords.code,
				taxRecords.taxableBase,
				taxRecords.taxAmount,
				taxRecords.filingStatus,
			)
			.orderBy(asc(taxRecords.code));
		return rows.map((row) => ({
			...row,
			taxableBase: Number(row.taxableBase),
			taxAmount: Number(row.taxAmount),
			correctionTotal: Number(row.correctionTotal),
		}));
	}

	async paginateWithholding(
		request: TTaxPaginationRequest,
	): Promise<TPaginationResult<TWithholdingTaxRecordSelect>> {
		const { organizationId, page, limit } = request;
		const where = and(
			eq(withholdingTaxRecords.organizationId, organizationId),
			isNull(withholdingTaxRecords.deletedAt),
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(withholdingTaxRecords)
			.where(where);
		const data = await this.database
			.select()
			.from(withholdingTaxRecords)
			.where(where)
			.orderBy(asc(withholdingTaxRecords.code))
			.limit(limit)
			.offset((page - 1) * limit);
		return paginationResult(request, total, data);
	}

	async findWithholdingById(
		organizationId: string,
		id: string,
	): Promise<TWithholdingTaxRecordSelect | null> {
		const [row] = await this.database
			.select()
			.from(withholdingTaxRecords)
			.where(
				and(
					eq(withholdingTaxRecords.id, id),
					eq(withholdingTaxRecords.organizationId, organizationId),
					isNull(withholdingTaxRecords.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async insertWithholding(
		row: {
			organizationId: string;
			code: string;
			taxTypeId: string;
			counterpartyType: string | null;
			counterpartyId: string | null;
			baseAmount: number;
			taxAmount: number;
			transactionDate: string | null;
			periodYear: number | null;
			periodMonth: number | null;
			taxObjectCode?: string | null;
			counterpartyTaxId?: string | null;
			sourceModule?: string | null;
			sourceId?: string | null;
		},
		tx?: unknown,
	): Promise<TWithholdingTaxRecordSelect> {
		const now = new Date();
		const [created] = await ((tx as TTx | undefined) ?? this.database)
			.insert(withholdingTaxRecords)
			.values({ ...row, createdAt: now, updatedAt: now })
			.returning();
		return created;
	}

	async listWithholdingsForPeriod(organizationId: string, year: number, month: number): Promise<TWithholdingTaxRecordSelect[]> {
		return this.database
			.select()
			.from(withholdingTaxRecords)
			.where(
				and(
					eq(withholdingTaxRecords.organizationId, organizationId),
					eq(withholdingTaxRecords.periodYear, year),
					eq(withholdingTaxRecords.periodMonth, month),
					sql`${withholdingTaxRecords.status} <> 'reversed'`,
					isNull(withholdingTaxRecords.deletedAt),
				),
			)
			.orderBy(asc(withholdingTaxRecords.code));
	}

	async updateWithholdingCoretax(
		organizationId: string,
		id: string,
		patch: Partial<{
			coretaxStatus: string;
			withholdingSlipNumber: string | null;
			counterpartyTaxId: string | null;
			taxObjectCode: string | null;
		}>,
	): Promise<TWithholdingTaxRecordSelect | null> {
		const [row] = await this.database
			.update(withholdingTaxRecords)
			.set({ ...patch, updatedAt: new Date() })
			.where(
				and(
					eq(withholdingTaxRecords.id, id),
					eq(withholdingTaxRecords.organizationId, organizationId),
					sql`${withholdingTaxRecords.status} <> 'reversed'`,
					isNull(withholdingTaxRecords.deletedAt),
				),
			)
			.returning();
		return row ?? null;
	}

	async reverseWithholdingBySource(
		organizationId: string,
		sourceModule: string,
		sourceId: string,
		tx?: unknown,
	): Promise<void> {
		await ((tx as TTx | undefined) ?? this.database)
			.update(withholdingTaxRecords)
			.set({ status: 'reversed', updatedAt: new Date() })
			.where(
				and(
					eq(withholdingTaxRecords.organizationId, organizationId),
					eq(withholdingTaxRecords.sourceModule, sourceModule),
					eq(withholdingTaxRecords.sourceId, sourceId),
					isNull(withholdingTaxRecords.deletedAt),
				),
			);
	}

	async updateRecordedWithholding(
		organizationId: string,
		id: string,
		patch: Partial<{
			counterpartyType: string | null;
			counterpartyId: string | null;
			baseAmount: number;
			taxAmount: number;
			transactionDate: string | null;
		}>,
	): Promise<TWithholdingTaxRecordSelect | null> {
		const [row] = await this.database
			.update(withholdingTaxRecords)
			.set({ ...patch, updatedAt: new Date() })
			.where(
				and(
					eq(withholdingTaxRecords.id, id),
					eq(withholdingTaxRecords.organizationId, organizationId),
					eq(withholdingTaxRecords.status, 'recorded'),
					isNull(withholdingTaxRecords.deletedAt),
				),
			)
			.returning();
		return row ?? null;
	}

	async transitionWithholding(
		organizationId: string,
		id: string,
		from: string,
		to: string,
	): Promise<TWithholdingTaxRecordSelect | null> {
		const [row] = await this.database
			.update(withholdingTaxRecords)
			.set({ status: to, updatedAt: new Date() })
			.where(
				and(
					eq(withholdingTaxRecords.id, id),
					eq(withholdingTaxRecords.organizationId, organizationId),
					eq(withholdingTaxRecords.status, from),
					isNull(withholdingTaxRecords.deletedAt),
				),
			)
			.returning();
		return row ?? null;
	}
}
