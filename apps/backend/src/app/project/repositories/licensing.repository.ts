import { DRIZZLE_TOKEN } from '@di/provider';
import { likePattern } from '@drizzle/search';
import { licenseApplications, licenseContracts, licenseKeys } from '@drizzle/schemas/project.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import { and, asc, count, desc, eq, getTableColumns, gte, ilike, inArray, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { ILicensingRepository, TContractData, TContractListQuery, TContractRow } from '../contracts/licensing.contract';

/** Drizzle implementation of {@link ILicensingRepository}. */
@injectable()
export class LicensingRepository implements ILicensingRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	// Applications -----------------------------------------------------------

	listApplications(includeRetired: boolean) {
		return this.database
			.select()
			.from(licenseApplications)
			.where(and(isNull(licenseApplications.deletedAt), includeRetired ? undefined : eq(licenseApplications.status, 'active')))
			.orderBy(asc(licenseApplications.code));
	}

	async findApplication(id: string) {
		const [row] = await this.database
			.select()
			.from(licenseApplications)
			.where(and(eq(licenseApplications.id, id), isNull(licenseApplications.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async createApplication(data: Parameters<ILicensingRepository['createApplication']>[0]) {
		const now = new Date();
		const [row] = await this.database
			.insert(licenseApplications)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async updateApplication(id: string, data: Parameters<ILicensingRepository['updateApplication']>[1]) {
		const [row] = await this.database
			.update(licenseApplications)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(licenseApplications.id, id), isNull(licenseApplications.deletedAt)))
			.returning();
		return row ?? null;
	}

	// Contracts --------------------------------------------------------------

	private selectContracts() {
		return this.database
			.select({
				...getTableColumns(licenseContracts),
				applicationCode: licenseApplications.code,
				applicationName: licenseApplications.name,
				applicationSource: licenseApplications.source,
			})
			.from(licenseContracts)
			.innerJoin(licenseApplications, eq(licenseApplications.id, licenseContracts.licenseApplicationId));
	}

	async paginateContracts(query: TContractListQuery & { dueBefore?: string }): Promise<TPaginationResult<TContractRow>> {
		const { page, limit, search, status, customerId, dueBefore } = query;
		const where = and(
			isNull(licenseContracts.deletedAt),
			status ? eq(licenseContracts.status, status) : undefined,
			customerId ? eq(licenseContracts.customerId, customerId) : undefined,
			dueBefore
				? and(eq(licenseContracts.status, 'active'), isNotNull(licenseContracts.endDate), lte(licenseContracts.endDate, dueBefore))
				: undefined,
			search
				? or(
						ilike(licenseContracts.code, likePattern(search)),
						ilike(licenseContracts.customerName, likePattern(search)),
						ilike(licenseContracts.packageName, likePattern(search)),
						ilike(licenseApplications.name, likePattern(search)),
						// A key typed in by the customer finds its contract.
						sql`exists (select 1 from ${licenseKeys} where ${licenseKeys.licenseContractId} = ${licenseContracts.id} and ${licenseKeys.deletedAt} is null and ${licenseKeys.licenseKey} ilike ${likePattern(search)})`,
					)
				: undefined,
		);
		const [{ value: total }] = await this.database
			.select({ value: count() })
			.from(licenseContracts)
			.innerJoin(licenseApplications, eq(licenseApplications.id, licenseContracts.licenseApplicationId))
			.where(where);
		const data = await this.selectContracts()
			.where(where)
			.orderBy(dueBefore ? asc(licenseContracts.endDate) : desc(licenseContracts.createdAt), desc(licenseContracts.id))
			.limit(limit)
			.offset((page - 1) * limit);
		return { meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data };
	}

	async findContract(id: string) {
		const [row] = await this.selectContracts()
			.where(and(eq(licenseContracts.id, id), isNull(licenseContracts.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async createContract(data: TContractData) {
		const now = new Date();
		const [row] = await this.database
			.insert(licenseContracts)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async updateDraft(id: string, data: Partial<TContractData>) {
		const [row] = await this.database
			.update(licenseContracts)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(licenseContracts.id, id), isNull(licenseContracts.deletedAt), eq(licenseContracts.status, 'draft')))
			.returning();
		return row ?? null;
	}

	async transition(id: string, from: string[], data: Parameters<ILicensingRepository['transition']>[2], tx?: TTx) {
		const [row] = await (tx ?? this.database)
			.update(licenseContracts)
			.set({ ...data, updatedAt: new Date() })
			.where(
				and(
					eq(licenseContracts.id, id),
					isNull(licenseContracts.deletedAt),
					inArray(licenseContracts.status, from as (typeof licenseContracts.$inferSelect.status)[]),
				),
			)
			.returning();
		return row ?? null;
	}

	async findOpenRenewal(contractId: string) {
		const [row] = await this.database
			.select()
			.from(licenseContracts)
			.where(
				and(
					eq(licenseContracts.renewedFromContractId, contractId),
					isNull(licenseContracts.deletedAt),
					inArray(licenseContracts.status, ['draft', 'active']),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async countDue(today: string, until: string) {
		const active = and(isNull(licenseContracts.deletedAt), eq(licenseContracts.status, 'active'), isNotNull(licenseContracts.endDate));
		const [[soon], [ended]] = await Promise.all([
			this.database
				.select({ value: count() })
				.from(licenseContracts)
				.where(and(active, gte(licenseContracts.endDate, today), lte(licenseContracts.endDate, until))),
			this.database
				.select({ value: count() })
				.from(licenseContracts)
				.where(and(active, lt(licenseContracts.endDate, today))),
		]);
		return { endingSoon: soon.value, ended: ended.value };
	}

	listRenewalCandidates(renewedFromContractId?: string) {
		return this.database
			.select()
			.from(licenseContracts)
			.where(
				and(
					isNull(licenseContracts.deletedAt),
					eq(licenseContracts.status, 'draft'),
					renewedFromContractId
						? eq(licenseContracts.renewedFromContractId, renewedFromContractId)
						: isNotNull(licenseContracts.renewedFromContractId),
					isNotNull(licenseContracts.orderId),
					isNotNull(licenseContracts.startDate),
				),
			);
	}

	async moveKeys(fromContractId: string, toContractId: string, oldEnd: string | null, newEnd: string | null, tx: TTx) {
		const live = and(eq(licenseKeys.licenseContractId, fromContractId), isNull(licenseKeys.deletedAt));
		const now = new Date();
		// A key without expiry already follows the contract end.
		if (oldEnd) await tx.update(licenseKeys).set({ expiresOn: newEnd, updatedAt: now }).where(and(live, eq(licenseKeys.expiresOn, oldEnd)));
		const moved = await tx
			.update(licenseKeys)
			.set({ licenseContractId: toContractId, updatedAt: now })
			.where(live)
			.returning({ id: licenseKeys.id });
		return moved.map((row) => row.id);
	}

	// Keys -------------------------------------------------------------------

	listKeys(contractId: string) {
		return this.database
			.select()
			.from(licenseKeys)
			.where(and(eq(licenseKeys.licenseContractId, contractId), isNull(licenseKeys.deletedAt)))
			.orderBy(asc(licenseKeys.createdAt), asc(licenseKeys.id));
	}

	async findKeyByValue(licenseKey: string) {
		const [row] = await this.database
			.select()
			.from(licenseKeys)
			.where(and(eq(licenseKeys.licenseKey, licenseKey), isNull(licenseKeys.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async createKey(data: Parameters<ILicensingRepository['createKey']>[0]) {
		const now = new Date();
		const [row] = await this.database
			.insert(licenseKeys)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		return row;
	}

	async revokeKey(contractId: string, keyId: string, actorUserId: string, reason: string) {
		const now = new Date();
		const [row] = await this.database
			.update(licenseKeys)
			.set({ status: 'revoked', revokedBy: actorUserId, revokedAt: now, revokeReason: reason, updatedAt: now })
			.where(
				and(
					eq(licenseKeys.id, keyId),
					eq(licenseKeys.licenseContractId, contractId),
					isNull(licenseKeys.deletedAt),
					eq(licenseKeys.status, 'active'),
				),
			)
			.returning();
		return row ?? null;
	}
}
