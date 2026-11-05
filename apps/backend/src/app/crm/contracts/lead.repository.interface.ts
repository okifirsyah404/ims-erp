import type { TPaginationResult } from '@ims-erp/common';
import type {
	LeadActivityType,
	LeadChannel,
	LeadSource,
	LeadStatus,
	TLeadActivitySelect,
	TLeadAttachmentSelect,
	TLeadSelect,
} from '@drizzle/schemas/crm.schema';

export type TLeadPaginationRequest = {
	page: number;
	limit: number;
	search?: string;
	status?: LeadStatus;
	source?: LeadSource;
	/** `null` = unassigned only; `undefined` = everyone. */
	ownerUserId?: string | null;
	/** Open leads whose next follow-up is at or before this instant. */
	followUpDueBefore?: Date;
};

export type TLeadCreateData = {
	name: string;
	companyName: string | null;
	phone: string | null;
	whatsapp: string | null;
	email: string | null;
	source: LeadSource;
	needs: string | null;
	estimatedValue?: number | null;
	nextFollowUpAt?: Date | null;
	ownerUserId: string | null;
	createdBy: string;
};

export type TLeadUpdateData = Partial<
	Omit<TLeadCreateData, 'ownerUserId' | 'createdBy'>
>;

/** A website submission (always unassigned, source `website`). */
export type TInquiryCreateData = {
	channel: LeadChannel;
	name: string;
	companyName: string | null;
	phone: string | null;
	whatsapp: string | null;
	email: string | null;
	needs: string;
	submission: Record<string, unknown>;
	reference: string;
	idempotencyKey: string | null;
};

export type TLeadAttachmentData = {
	fileName: string;
	contentType: string;
	sizeBytes: number;
	storageKey: string;
};

/** Persistence port for `crm.leads` and its attachments (live rows only). */
export interface ILeadRepository {
	paginate(request: TLeadPaginationRequest): Promise<TPaginationResult<TLeadSelect>>;

	findById(id: string): Promise<TLeadSelect | null>;

	findByIdempotencyKey(idempotencyKey: string): Promise<TLeadSelect | null>;

	create(data: TLeadCreateData): Promise<TLeadSelect>;

	/** Lead and its attachments in one transaction. */
	createInquiry(data: TInquiryCreateData, attachments: TLeadAttachmentData[]): Promise<TLeadSelect>;

	/** `null` when the lead is missing or already converted. */
	update(id: string, patch: TLeadUpdateData): Promise<TLeadSelect | null>;

	/** `null` when the lead is missing or already converted. */
	setStatus(id: string, status: LeadStatus, lostReason: string | null): Promise<TLeadSelect | null>;

	assign(id: string, ownerUserId: string | null): Promise<TLeadSelect | null>;

	/** Open → `won` with the customer; `null` when not open (race). */
	markConverted(id: string, customerId: string): Promise<TLeadSelect | null>;

	softDelete(id: string): Promise<boolean>;

	listAttachments(leadId: string): Promise<TLeadAttachmentSelect[]>;
}

/** Persistence port for `crm.lead_activities`. */
export interface ILeadActivityRepository {
	/** Newest first. */
	listByLead(leadId: string): Promise<TLeadActivitySelect[]>;

	create(data: {
		leadId: string;
		activityType: LeadActivityType;
		notes: string;
		occurredAt: Date;
		createdBy: string;
	}): Promise<TLeadActivitySelect>;
}
