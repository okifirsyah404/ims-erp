import { z } from 'zod';
import {
	TICKET_CHANNELS,
	TICKET_STATUSES,
	type TServiceTicketInsert,
	type TServiceTicketSelect,
} from '@drizzle/schemas/aftersales.schema';
import type { TPaginationResult } from '@ims-erp/common';

/**
 * Request schemas for service tickets (`/service-tickets`, ADR-0011 step 6c).
 * Money is IDR minor units.
 */

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => (value ? value : null));

export const createTicketSchema = z.object({
	customerId: z.uuid(),
	projectId: z.uuid().nullish(),
	serialNumber: optionalText(100),
	deviceDescription: optionalText(300),
	channel: z.enum(TICKET_CHANNELS),
	reporterName: z.string().trim().min(1).max(200),
	reporterContact: optionalText(200),
	complaint: z.string().trim().min(1).max(4000),
	/** Defaults to now. */
	reportedAt: z.coerce.date().nullish(),
});

export const assignTicketSchema = z.object({ assigneeUserId: z.string().min(1) });

export const resolveTicketSchema = z.object({
	resolution: z.string().trim().min(1).max(4000),
	serviceCost: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
});

export const closeTicketSchema = z.object({
	confirmedByName: z.string().trim().min(1).max(200),
	confirmationChannel: z.enum(TICKET_CHANNELS),
});

export const ticketListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z.string().trim().max(100).optional(),
	status: z.enum(TICKET_STATUSES).optional(),
});

export const warrantyCheckQuerySchema = z.object({
	serialNumber: z.string().trim().max(100).optional(),
	projectId: z.uuid().optional(),
});

export const ticketIdParamSchema = z.object({ id: z.uuid() });

export type TCreateTicketRequest = z.output<typeof createTicketSchema>;
export type TTicketListQuery = z.output<typeof ticketListQuerySchema>;

export type TTicketCreateData = Omit<TServiceTicketInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

/**
 * Persistence port for `aftersales.service_tickets` (live rows). State
 * changes are guarded on the current status inside the update (`null` = the
 * ticket was no longer in an allowed state).
 */
export interface IServiceTicketRepository {
	paginate(query: TTicketListQuery & { assigneeUserId?: string }): Promise<TPaginationResult<TServiceTicketSelect>>;
	findById(id: string): Promise<TServiceTicketSelect | null>;
	create(data: TTicketCreateData): Promise<TServiceTicketSelect>;
	transition(
		id: string,
		from: TServiceTicketSelect['status'][],
		data: Partial<Omit<TServiceTicketInsert, 'id' | 'code' | 'createdAt' | 'deletedAt'>>,
	): Promise<TServiceTicketSelect | null>;
}
