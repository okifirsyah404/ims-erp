import { DRIZZLE_TOKEN } from '@di/provider';
import {
	type DocumentAccessAction,
	documentAccessLogs,
	documentFiles,
	documentShares,
	documentTemplates,
	documents,
	type TDocumentAccessLogSelect,
	type TDocumentFileInsert,
	type TDocumentFileSelect,
	type TDocumentInsert,
	type TDocumentSelect,
	type TDocumentShareInsert,
	type TDocumentShareSelect,
	type TDocumentTemplateInsert,
	type TDocumentTemplateSelect,
} from '@drizzle/schemas/document.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import { and, count, desc, eq, ilike, isNull, ne, or } from 'drizzle-orm';
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

	async markVoidBySource(
		module: string,
		sourceType: string,
		sourceId: string,
		tx?: TTx,
	): Promise<number> {
		const rows = await (tx ?? this.database)
			.update(documents)
			.set({ status: 'void', updatedAt: new Date() })
			.where(
				and(
					eq(documents.module, module),
					eq(documents.sourceType, sourceType),
					eq(documents.sourceId, sourceId),
					isNull(documents.deletedAt),
					ne(documents.status, 'void'),
				),
			)
			.returning({ id: documents.id });
		return rows.length;
	}

	async findLiveBySource(module: string, sourceType: string, sourceId: string): Promise<TDocumentSelect | null> {
		const [row] = await this.database
			.select()
			.from(documents)
			.where(
				and(
					eq(documents.module, module),
					eq(documents.sourceType, sourceType),
					eq(documents.sourceId, sourceId),
					isNull(documents.deletedAt),
					ne(documents.status, 'void'),
				),
			)
			.orderBy(desc(documents.createdAt), desc(documents.id))
			.limit(1);
		return row ?? null;
	}

	async logAccess(entry: {
		documentId: string;
		organizationId: string | null;
		accessedByUserId: string | null;
		action: DocumentAccessAction;
		ipAddress?: string | null;
		userAgent?: string | null;
	}): Promise<void> {
		const now = new Date();
		await this.database.insert(documentAccessLogs).values({
			...entry,
			accessedAt: now,
			createdAt: now,
			updatedAt: now,
		});
	}

	listAccessTrail(documentId: string, limit: number): Promise<TDocumentAccessLogSelect[]> {
		return this.database
			.select()
			.from(documentAccessLogs)
			.where(eq(documentAccessLogs.documentId, documentId))
			.orderBy(desc(documentAccessLogs.accessedAt), desc(documentAccessLogs.id))
			.limit(limit);
	}

	listFiles(documentId: string): Promise<TDocumentFileSelect[]> {
		return this.database
			.select()
			.from(documentFiles)
			.where(and(eq(documentFiles.documentId, documentId), isNull(documentFiles.deletedAt)))
			.orderBy(desc(documentFiles.uploadedAt), desc(documentFiles.id));
	}

	async findFile(documentId: string, fileId: string): Promise<TDocumentFileSelect | null> {
		const [row] = await this.database
			.select()
			.from(documentFiles)
			.where(
				and(
					eq(documentFiles.id, fileId),
					eq(documentFiles.documentId, documentId),
					isNull(documentFiles.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async insertFile(values: TDocumentFileInsert): Promise<TDocumentFileSelect> {
		const [row] = await this.database.insert(documentFiles).values(values).returning();
		return row;
	}

	async softDeleteFile(fileId: string): Promise<TDocumentFileSelect | null> {
		const now = new Date();
		const [row] = await this.database
			.update(documentFiles)
			.set({ deletedAt: now, updatedAt: now })
			.where(and(eq(documentFiles.id, fileId), isNull(documentFiles.deletedAt)))
			.returning();
		return row ?? null;
	}

	listShares(documentId: string): Promise<TDocumentShareSelect[]> {
		return this.database
			.select()
			.from(documentShares)
			.where(and(eq(documentShares.documentId, documentId), isNull(documentShares.deletedAt)))
			.orderBy(desc(documentShares.sharedAt), desc(documentShares.id));
	}

	async insertShare(values: TDocumentShareInsert): Promise<TDocumentShareSelect> {
		const [row] = await this.database.insert(documentShares).values(values).returning();
		return row;
	}

	async findShareByToken(token: string): Promise<TDocumentShareSelect | null> {
		const [row] = await this.database
			.select()
			.from(documentShares)
			.where(
				and(
					eq(documentShares.token, token),
					eq(documentShares.isRevoked, false),
					isNull(documentShares.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async revokeShare(shareId: string): Promise<TDocumentShareSelect | null> {
		const now = new Date();
		const [row] = await this.database
			.update(documentShares)
			.set({ isRevoked: true, updatedAt: now })
			.where(
				and(
					eq(documentShares.id, shareId),
					eq(documentShares.isRevoked, false),
					isNull(documentShares.deletedAt),
				),
			)
			.returning();
		return row ?? null;
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
