import { DRIZZLE_TOKEN } from '@di/provider';
import {
	applicationApiKeys,
	licensableApplications,
	licenseActivations,
	licenseContracts,
	licenseEvents,
	licenseKeys,
} from '@drizzle/schemas/licensing.schema';
import type { TTx } from '@drizzle/types';
import { and, asc, count, desc, eq, getTableColumns, inArray, isNull, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { ILicenseApiRepository, TEventListQuery } from '../contracts/license-api.contract';

/** Drizzle implementation of {@link ILicenseApiRepository}. */
@injectable()
export class LicenseApiRepository implements ILicenseApiRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	// Application API keys ---------------------------------------------------

	listApiKeys(applicationId: string) {
		return this.database
			.select()
			.from(applicationApiKeys)
			.where(and(eq(applicationApiKeys.licensableApplicationId, applicationId), isNull(applicationApiKeys.deletedAt)))
			.orderBy(desc(applicationApiKeys.createdAt));
	}

	async findApiKey(id: string) {
		const [row] = await this.database
			.select()
			.from(applicationApiKeys)
			.where(and(eq(applicationApiKeys.id, id), isNull(applicationApiKeys.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async findApiKeyByAuthId(apiKeyId: string) {
		const [row] = await this.database
			.select()
			.from(applicationApiKeys)
			.where(and(eq(applicationApiKeys.apiKeyId, apiKeyId), isNull(applicationApiKeys.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async createApiKey(data: Parameters<ILicenseApiRepository['createApiKey']>[0]) {
		const now = new Date();
		const [row] = await this.database
			.insert(applicationApiKeys)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async revokeApiKey(id: string, actorUserId: string) {
		const now = new Date();
		const [row] = await this.database
			.update(applicationApiKeys)
			.set({ status: 'revoked', revokedBy: actorUserId, revokedAt: now, updatedAt: now })
			.where(and(eq(applicationApiKeys.id, id), isNull(applicationApiKeys.deletedAt), eq(applicationApiKeys.status, 'active')))
			.returning();
		return row ?? null;
	}

	async touchApiKey(id: string) {
		await this.database.update(applicationApiKeys).set({ lastUsedAt: new Date() }).where(eq(applicationApiKeys.id, id));
	}

	// Keys -------------------------------------------------------------------

	async findKeyWithContract(licenseKey: string) {
		const [row] = await this.database
			.select({
				key: getTableColumns(licenseKeys),
				contract: {
					...getTableColumns(licenseContracts),
					applicationCode: licensableApplications.code,
					applicationName: licensableApplications.name,
					applicationSource: licensableApplications.source,
				},
			})
			.from(licenseKeys)
			.innerJoin(licenseContracts, eq(licenseContracts.id, licenseKeys.licenseContractId))
			.innerJoin(licensableApplications, eq(licensableApplications.id, licenseContracts.licensableApplicationId))
			.where(and(eq(licenseKeys.licenseKey, licenseKey), isNull(licenseKeys.deletedAt), isNull(licenseContracts.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	// Activations ------------------------------------------------------------

	async findActiveActivation(licenseKeyId: string, instanceId: string) {
		const [row] = await this.database
			.select()
			.from(licenseActivations)
			.where(
				and(
					eq(licenseActivations.licenseKeyId, licenseKeyId),
					eq(licenseActivations.instanceId, instanceId),
					eq(licenseActivations.status, 'active'),
					isNull(licenseActivations.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async listActivations(licenseKeyIds: string[]) {
		if (licenseKeyIds.length === 0) return [];
		return this.database
			.select()
			.from(licenseActivations)
			.where(and(inArray(licenseActivations.licenseKeyId, licenseKeyIds), isNull(licenseActivations.deletedAt)))
			.orderBy(asc(licenseActivations.status), desc(licenseActivations.lastSeenAt));
	}

	createActivationLocked(data: Parameters<ILicenseApiRepository['createActivationLocked']>[0], maxActivations: number) {
		return this.database.transaction(async (tx) => {
			// Serialises seat taking per key.
			await tx.execute(sql`select 1 from ${licenseKeys} where ${licenseKeys.id} = ${data.licenseKeyId} for update`);
			const [{ value: active }] = await tx
				.select({ value: count() })
				.from(licenseActivations)
				.where(
					and(
						eq(licenseActivations.licenseKeyId, data.licenseKeyId),
						eq(licenseActivations.status, 'active'),
						isNull(licenseActivations.deletedAt),
					),
				);
			if (active >= maxActivations) return null;
			const now = new Date();
			const [row] = await tx
				.insert(licenseActivations)
				.values({ ...data, createdAt: now, updatedAt: now })
				.returning();
			return row;
		});
	}

	async touchActivation(id: string, ip: string | null) {
		const now = new Date();
		await this.database
			.update(licenseActivations)
			.set({ lastSeenAt: now, lastIp: ip, updatedAt: now })
			.where(eq(licenseActivations.id, id));
	}

	async deactivate(id: string, actorUserId: string | null) {
		const now = new Date();
		const [row] = await this.database
			.update(licenseActivations)
			.set({ status: 'deactivated', deactivatedAt: now, deactivatedBy: actorUserId, updatedAt: now })
			.where(and(eq(licenseActivations.id, id), eq(licenseActivations.status, 'active'), isNull(licenseActivations.deletedAt)))
			.returning();
		return row ?? null;
	}

	// Events -----------------------------------------------------------------

	async insertEvent(data: Parameters<ILicenseApiRepository['insertEvent']>[0], tx?: TTx) {
		const now = new Date();
		await (tx ?? this.database).insert(licenseEvents).values({ ...data, createdAt: now, updatedAt: now });
	}

	async paginateEvents(query: TEventListQuery) {
		const { page, limit, contractId } = query;
		const where = and(isNull(licenseEvents.deletedAt), contractId ? eq(licenseEvents.licenseContractId, contractId) : undefined);
		const [{ value: total }] = await this.database.select({ value: count() }).from(licenseEvents).where(where);
		const data = await this.database
			.select({
				...getTableColumns(licenseEvents),
				contractCode: licenseContracts.code,
				customerName: licenseContracts.customerName,
			})
			.from(licenseEvents)
			.leftJoin(licenseContracts, eq(licenseContracts.id, licenseEvents.licenseContractId))
			.where(where)
			.orderBy(desc(licenseEvents.eventAt), desc(licenseEvents.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return { meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data };
	}
}

