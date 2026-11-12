import { DRIZZLE_TOKEN } from '@di/provider';
import {
	type DocumentAccessAction,
	documentAccessLogs,
	documentTemplates,
	documents,
	type TDocumentInsert,
	type TDocumentSelect,
	type TDocumentTemplateInsert,
	type TDocumentTemplateSelect,
} from '@drizzle/schemas/document.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import { and, count, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IDocumentRepository } from '../contracts/document.repository.interface';
import type { TDocumentListQuery } from '../contracts/document.contract';

/**
 * Drizzle implementation of {@link IDocumentRepository}.
 *
 * @remarks
 * Every read filters soft-deleted rows. `organization_id IS NULL` means
 * company-wide, so a tenant query also sees the company-wide rows.
 */
@injectable()
export class DocumentRepository implements IDocumentRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async list(filter: TDocumentListQuery): Promise<TPaginationResult<TDocumentSelect>> {
		const { page, limit, search, status, documentType, organizationId } = filter;
		const conditions = [isNull(documents.deletedAt)];
		if (status) conditions.push(eq(documents.status, status));
		if (documentType) conditions.push(eq(documents.documentType, documentType));
		if (organizationId) {
			conditions.push(
				or(eq(documents.organizationId, organizationId), isNull(documents.organizationId))!,
			);
		}
		if (search) {
			conditions.push(
				or(ilike(documents.code, `%${search}%`), ilike(documents.title, `%${search}%`))!,
			);
		}

		const where = and(...conditions);
		const [rows, [totals]] = await Promise.all([
			this.database
				.select()
				.from(documents)
				.where(where)
				.orderBy(desc(documents.createdAt), desc(documents.id))
				.limit(limit)
				.offset((page - 1) * limit),
			this.database.select({ value: count() }).from(documents).where(where),
		]);

		const total = Number(totals?.value ?? 0);
		return {
			meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
			data: rows,
		};
	}

	async findById(id: string): Promise<TDocumentSelect | null> {
		const [row] = await this.database
			.select()
			.from(documents)
			.where(and(eq(documents.id, id), isNull(documents.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async insert(values: TDocumentInsert, tx?: TTx): Promise<TDocumentSelect> {
		const [row] = await (tx ?? this.database).insert(documents).values(values).returning();
		return row;
	}

	async markVoid(id: string): Promise<TDocumentSelect | null> {
		const [row] = await this.database
			.update(documents)
			.set({ status: 'void', updatedAt: new Date() })
			.where(and(eq(documents.id, id), isNull(documents.deletedAt)))
			.returning();
		return row ?? null;
	}

	async logAccess(entry: {
		documentId: string;
		organizationId: string | null;
		accessedByUserId: string;
		action: DocumentAccessAction;
	}): Promise<void> {
		const now = new Date();
		await this.database.insert(documentAccessLogs).values({
			...entry,
			accessedAt: now,
			createdAt: now,
			updatedAt: now,
		});
	}

	listTemplates(organizationId: string | null): Promise<TDocumentTemplateSelect[]> {
		const live = isNull(documentTemplates.deletedAt);
		return this.database
			.select()
			.from(documentTemplates)
			.where(
				organizationId
					? and(
							live,
							or(
								eq(documentTemplates.organizationId, organizationId),
								isNull(documentTemplates.organizationId),
							),
						)
					: and(live, isNull(documentTemplates.organizationId)),
			)
			.orderBy(documentTemplates.code, desc(documentTemplates.version));
	}

	async insertTemplate(values: TDocumentTemplateInsert): Promise<TDocumentTemplateSelect> {
		const [row] = await this.database.insert(documentTemplates).values(values).returning();
		return row;
	}
}
