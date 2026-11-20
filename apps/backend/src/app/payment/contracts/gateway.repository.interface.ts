import type { TGatewayInsert, TGatewaySelect } from '@drizzle/schemas/payment.schema';
import type { TTx } from '@drizzle/types';

/** A new gateway row; ids and timestamps are the repository's. */
export type TGatewayData = Omit<TGatewayInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

/**
 * Persistence port of `payment.gateways` (live rows only).
 *
 * @remarks
 * The ciphertext columns are read and written here and nowhere else. The API
 * never returns them: `GatewayConfigService` maps a row to a view without
 * `secretCiphertext`/`secretIv`/`secretTag`/`webhookToken*`.
 */
export interface IGatewayRepository {
	list(organizationId: string): Promise<TGatewaySelect[]>;
	findById(organizationId: string, id: string): Promise<TGatewaySelect | null>;
	findByCode(organizationId: string, provider: string, code: string): Promise<TGatewaySelect | null>;
	/** The organization's default gateway, or `null`. */
	findDefault(organizationId: string): Promise<TGatewaySelect | null>;
	/** The active gateway of a provider, for an inbound webhook. */
	findActiveByProvider(organizationId: string | null, provider: string): Promise<TGatewaySelect | null>;
	create(data: TGatewayData): Promise<TGatewaySelect>;
	update(organizationId: string, id: string, patch: Partial<TGatewayInsert>, tx?: TTx): Promise<TGatewaySelect | null>;
	/** Makes one row the default and clears the flag on the others. */
	setDefault(organizationId: string, id: string): Promise<TGatewaySelect | null>;
}
