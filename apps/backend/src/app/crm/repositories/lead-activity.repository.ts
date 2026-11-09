import { DRIZZLE_TOKEN } from '@di/provider';
import { leadActivities, type TLeadActivitySelect } from '@drizzle/schemas/crm.schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { ILeadActivityRepository } from '../contracts/lead.repository.interface';

/** Drizzle implementation of {@link ILeadActivityRepository}. */
@injectable()
export class LeadActivityRepository implements ILeadActivityRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	listByLead(leadId: string): Promise<TLeadActivitySelect[]> {
		return this.database
			.select()
			.from(leadActivities)
			.where(and(eq(leadActivities.leadId, leadId), isNull(leadActivities.deletedAt)))
			.orderBy(desc(leadActivities.occurredAt), desc(leadActivities.id));
	}

	async create(data: Parameters<ILeadActivityRepository['create']>[0]): Promise<TLeadActivitySelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(leadActivities)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}
}
