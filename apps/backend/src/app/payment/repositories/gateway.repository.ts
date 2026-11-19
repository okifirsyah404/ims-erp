import { DRIZZLE_TOKEN } from '@di/provider';
import { gateways, type TGatewayInsert, type TGatewaySelect } from '@drizzle/schemas/payment.schema';
import type { TTx } from '@drizzle/types';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IGatewayRepository, TGatewayData } from '../contracts/gateway.repository.interface';

/**
 * Drizzle queries of `payment.gateways` (ADR-0024 Q18).
 *
 * @remarks
 * Reads and writes the encrypted secret columns; the API view is built in
 * `GatewayConfigService`, which strips them.
 */
@injectable()
export class GatewayRepository implements IGatewayRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	list(organizationId: string): Promise<TGatewaySelect[]> {
		return this.database
			.select()
			.from(gateways)
			.where(and(eq(gateways.organizationId, organizationId), isNull(gateways.deletedAt)))
			.orderBy(asc(gateways.provider), asc(gateways.code));
	}

	async findById(organizationId: string, id: string): Promise<TGatewaySelect | null> {
		const [row] = await this.database
			.select()
			.from(gateways)
			.where(and(eq(gateways.id, id), eq(gateways.organizationId, organizationId), isNull(gateways.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async findByCode(organizationId: string, provider: string, code: string): Promise<TGatewaySelect | null> {
		const [row] = await this.database
			.select()
			.from(gateways)
			.where(
				and(
					eq(gateways.organizationId, organizationId),
					eq(gateways.provider, provider),
					eq(gateways.code, code),
					isNull(gateways.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async findDefault(organizationId: string): Promise<TGatewaySelect | null> {
		const [row] = await this.database
			.select()
			.from(gateways)
			.where(
				and(
					eq(gateways.organizationId, organizationId),
					eq(gateways.isDefault, true),
					eq(gateways.isActive, true),
					isNull(gateways.deletedAt),
				),
			)
			.limit(1);
		return row ?? null;
	}

	async findActiveByProvider(organizationId: string | null, provider: string): Promise<TGatewaySelect | null> {
		const scope = organizationId ? eq(gateways.organizationId, organizationId) : isNull(gateways.organizationId);
		const [row] = await this.database
			.select()
			.from(gateways)
			.where(and(scope, eq(gateways.provider, provider), eq(gateways.isActive, true), isNull(gateways.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async create(data: TGatewayData): Promise<TGatewaySelect> {
		const now = new Date();
		const [row] = await this.database
			.insert(gateways)
			.values({ ...data, createdAt: now, updatedAt: now })
			.returning();
		return row!;
	}

	async update(
		organizationId: string,
		id: string,
		patch: Partial<TGatewayInsert>,
		tx?: TTx,
	): Promise<TGatewaySelect | null> {
		const [row] = await (tx ?? this.database)
			.update(gateways)
			.set({ ...patch, updatedAt: new Date() })
			.where(and(eq(gateways.id, id), eq(gateways.organizationId, organizationId), isNull(gateways.deletedAt)))
			.returning();
		return row ?? null;
	}

	async setDefault(organizationId: string, id: string): Promise<TGatewaySelect | null> {
		return this.database.transaction(async (tx) => {
			await tx
				.update(gateways)
				.set({ isDefault: false, updatedAt: new Date() })
				.where(and(eq(gateways.organizationId, organizationId), eq(gateways.isDefault, true)));
			const [row] = await tx
				.update(gateways)
				.set({ isDefault: true, updatedAt: new Date() })
				.where(and(eq(gateways.id, id), eq(gateways.organizationId, organizationId), isNull(gateways.deletedAt)))
				.returning();
			return row ?? null;
		});
	}
}
