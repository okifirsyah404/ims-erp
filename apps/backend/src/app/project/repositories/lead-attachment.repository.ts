import { DRIZZLE_TOKEN } from '@di/provider';
import { leadAttachments, type TLeadAttachmentSelect } from '@drizzle/schemas/project.schema';
import type { TTx } from '@drizzle/types';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type {
	ILeadAttachmentRepository,
	TLeadAttachmentData,
} from '../contracts/lead.repository.interface';

/** Drizzle implementation of {@link ILeadAttachmentRepository} on `project.lead_attachments`. */
@injectable()
export class LeadAttachmentRepository implements ILeadAttachmentRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	listByLead(leadId: string): Promise<TLeadAttachmentSelect[]> {
		return this.database
			.select()
			.from(leadAttachments)
			.where(and(eq(leadAttachments.leadId, leadId), isNull(leadAttachments.deletedAt)))
			.orderBy(asc(leadAttachments.createdAt), asc(leadAttachments.id));
	}

	async createMany(leadId: string, files: TLeadAttachmentData[], tx?: TTx): Promise<void> {
		if (files.length === 0) return;
		const now = new Date();
		await (tx ?? this.database)
			.insert(leadAttachments)
			.values(files.map((file) => ({ ...file, leadId, createdAt: now, updatedAt: now })));
	}
}
