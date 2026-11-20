import { z } from 'zod';
import type {
	TLicenseApiKeyInsert,
	TLicenseApiKeySelect,
	TLicenseActivationInsert,
	TLicenseActivationSelect,
	TLicenseEventInsert,
	TLicenseEventSelect,
	TLicenseKeySelect,
} from '@drizzle/schemas/project.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import type { TContractRow } from './licensing.contract';

/**
 * The license API (M03 stage 2): machine requests from an own application,
 * the staff screens around it, and their persistence port.
 */

const instanceId = z.string().trim().min(1).max(200);

export const validateBodySchema = z.object({
	licenseKey: z.string().trim().min(1).max(500),
	/** When sent, the installation must hold an active seat of the key. */
	instanceId: instanceId.optional(),
});

export const activateBodySchema = z.object({
	licenseKey: z.string().trim().min(1).max(500),
	instanceId,
	deviceName: z.string().trim().max(200).optional(),
});

export const deactivateBodySchema = z.object({
	licenseKey: z.string().trim().min(1).max(500),
	instanceId,
});

export const apiKeyBodySchema = z.object({ name: z.string().trim().min(1).max(100) });

export const eventListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(50),
	contractId: z.uuid().optional(),
});

export const apiKeyParamSchema = z.object({ id: z.uuid(), apiKeyId: z.uuid() });
export const activationParamSchema = z.object({ id: z.uuid(), activationId: z.uuid() });

export type TValidateBody = z.output<typeof validateBodySchema>;
export type TActivateBody = z.output<typeof activateBodySchema>;
export type TDeactivateBody = z.output<typeof deactivateBodySchema>;
export type TEventListQuery = z.output<typeof eventListQuerySchema>;

/** A key with the contract it belongs to (and the contract's application). */
export type TKeyWithContract = { key: TLicenseKeySelect; contract: TContractRow };

/** An event as listed, with the key and contract codes. */
export type TEventRow = TLicenseEventSelect & { contractCode: string | null; customerName: string | null };

/** Persistence port of the license API tables (live rows). */
export interface ILicenseApiRepository {
	listApiKeys(applicationId: string): Promise<TLicenseApiKeySelect[]>;
	findApiKey(id: string): Promise<TLicenseApiKeySelect | null>;
	findApiKeyByAuthId(apiKeyId: string): Promise<TLicenseApiKeySelect | null>;
	createApiKey(data: Omit<TLicenseApiKeyInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<TLicenseApiKeySelect>;
	revokeApiKey(id: string, actorUserId: string): Promise<TLicenseApiKeySelect | null>;
	touchApiKey(id: string): Promise<void>;

	/** The live key with this exact value, and its contract. */
	findKeyWithContract(licenseKey: string): Promise<TKeyWithContract | null>;

	findActiveActivation(licenseKeyId: string, instanceId: string): Promise<TLicenseActivationSelect | null>;
	listActivations(licenseKeyIds: string[]): Promise<TLicenseActivationSelect[]>;
	/**
	 * Takes a seat when fewer than `maxActivations` are active, under a lock
	 * on the key (`null` = no seat left).
	 */
	createActivationLocked(
		data: Omit<TLicenseActivationInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
		maxActivations: number,
	): Promise<TLicenseActivationSelect | null>;
	touchActivation(id: string, ip: string | null): Promise<void>;
	deactivate(id: string, actorUserId: string | null): Promise<TLicenseActivationSelect | null>;

	insertEvent(data: Omit<TLicenseEventInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>, tx?: TTx): Promise<void>;
	paginateEvents(query: TEventListQuery): Promise<TPaginationResult<TEventRow>>;
}
