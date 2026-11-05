import { DRIZZLE_TOKEN } from '@di/provider';
import {
	type DocumentType,
	documentSequences,
	type TDocumentSequenceSelect,
} from '@drizzle/schemas/organization.schema';
import type { TTx } from '@drizzle/types';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	IDocumentSequenceRepository,
	TDocumentSequenceSettings,
} from '../contracts/document-sequence.repository.interface';

/**
 * Drizzle implementation of {@link IDocumentSequenceRepository}.
 *
 * @remarks
 * Every write targets the live row of a document type through the partial
 * unique index `document_sequences_type_uq` (`WHERE deleted_at IS NULL`),
 * so `ON CONFLICT` names the same predicate.
 */
@injectable()
export class DocumentSequenceRepository implements IDocumentSequenceRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	findAll(): Promise<TDocumentSequenceSelect[]> {
		return this.database
			.select()
			.from(documentSequences)
			.where(isNull(documentSequences.deletedAt));
	}

	async findByType(documentType: DocumentType, tx?: TTx): Promise<TDocumentSequenceSelect | null> {
		const [row] = await (tx ?? this.database)
			.select()
			.from(documentSequences)
			.where(and(eq(documentSequences.documentType, documentType), isNull(documentSequences.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async allocate(module: string, documentType: DocumentType, periodKey: string, tx?: TTx): Promise<number> {
		const now = new Date();
		// `next_number` holds the number the NEXT caller gets; the issued
		// number is therefore the stored value minus one after the update.
		const [row] = await (tx ?? this.database)
			.insert(documentSequences)
			.values({ module, documentType, periodKey, nextNumber: 2, createdAt: now, updatedAt: now })
			.onConflictDoUpdate({
				target: documentSequences.documentType,
				targetWhere: sql`deleted_at IS NULL`,
				set: {
					nextNumber: sql`CASE WHEN ${documentSequences.periodKey} = ${periodKey}
						THEN ${documentSequences.nextNumber} + 1 ELSE 2 END`,
					periodKey,
					updatedAt: now,
				},
			})
			.returning({ nextNumber: documentSequences.nextNumber });
		return row.nextNumber - 1;
	}

	async saveSettings(settings: TDocumentSequenceSettings, periodKey: string): Promise<TDocumentSequenceSelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(documentSequences)
			.values({ ...settings, periodKey, nextNumber: 1, createdAt: now, updatedAt: now })
			.onConflictDoUpdate({
				target: documentSequences.documentType,
				targetWhere: sql`deleted_at IS NULL`,
				set: {
					pattern: settings.pattern,
					resetPolicy: settings.resetPolicy,
					updatedBy: settings.updatedBy,
					updatedAt: now,
				},
			})
			.returning();
		return row;
	}
}
