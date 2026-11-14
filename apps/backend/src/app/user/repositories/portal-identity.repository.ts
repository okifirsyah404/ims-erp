import { DRIZZLE_TOKEN } from '@di/provider';
import { portalIdentities, type TPortalIdentitySelect } from '@drizzle/schemas/portal.schema';
import { and, eq, isNull, ne } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IPortalIdentityRepository } from '../contracts/portal-account.contract';

/** Drizzle implementation of {@link IPortalIdentityRepository} (`auth.portal_identities`). */
@injectable()
export class PortalIdentityRepository implements IPortalIdentityRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async findLiveByEntity(portalType: 'customer', entityId: string): Promise<TPortalIdentitySelect | null> {
		const [row] = await this.database
			.select()
			.from(portalIdentities)
			.where(and(eq(portalIdentities.portalType, portalType), eq(portalIdentities.linkedEntityId, entityId), isNull(portalIdentities.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async findLiveByUser(userId: string): Promise<TPortalIdentitySelect | null> {
		const [row] = await this.database
			.select()
			.from(portalIdentities)
			.where(and(eq(portalIdentities.userId, userId), isNull(portalIdentities.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async findLiveById(id: string): Promise<TPortalIdentitySelect | null> {
		const [row] = await this.database
			.select()
			.from(portalIdentities)
			.where(and(eq(portalIdentities.id, id), isNull(portalIdentities.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async create(data: { userId: string; portalType: 'customer'; linkedEntityId: string; createdBy: string }): Promise<TPortalIdentitySelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(portalIdentities)
			.values({ ...data, status: 'active', createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async revoke(id: string): Promise<TPortalIdentitySelect | null> {
		const now = new Date();
		const [row] = await this.database
			.update(portalIdentities)
			.set({ status: 'revoked', deletedAt: now, updatedAt: now })
			.where(and(eq(portalIdentities.id, id), isNull(portalIdentities.deletedAt), ne(portalIdentities.status, 'revoked')))
			.returning();
		return row ?? null;
	}

	async touchLogin(id: string): Promise<void> {
		await this.database.update(portalIdentities).set({ lastLoginAt: new Date() }).where(eq(portalIdentities.id, id));
	}
}
